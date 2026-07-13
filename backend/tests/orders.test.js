import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';

// Creates a verified cook with one dish and returns { cook token, dishId }.
async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request
    .post('/api/cook/dishes')
    .set(authHeader(accessToken))
    .send({ name: 'Борщ', price: 90 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// Registers a buyer, fills the cart with a dish, returns the buyer token.
async function buyerWithCart(dishId, quantity = 2) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request
    .post('/api/cart/add')
    .set(authHeader(buyer.accessToken))
    .send({ dishId, quantity });
  return buyer.accessToken;
}

describe('Orders & cook dashboard (Module 3.3)', () => {
  it('checks out the cart into an order and empties the cart', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId, 2);

    const res = await request
      .post('/api/orders')
      .set(authHeader(buyerToken))
      .send({ addressText: 'Черкаси, вул. Тестова, 1', note: 'Без цибулі' });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('NEW');
    expect(res.body.order.total).toBe(180);
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.addressText).toContain('Тестова');

    const cart = await request.get('/api/cart').set(authHeader(buyerToken));
    expect(cart.body.cart.itemCount).toBe(0);
  });

  it('rejects checkout with an empty cart', async () => {
    const buyer = await registerUser({ role: 'CUSTOMER' });
    const res = await request
      .post('/api/orders')
      .set(authHeader(buyer.accessToken))
      .send({ addressText: 'Черкаси' });
    expect(res.status).toBe(400);
  });

  it('blocks checkout when a dish went out of stock after being added', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    // Cook marks it unavailable while it sits in the buyer's cart.
    await request.put(`/api/cook/dishes/${dishId}`).set(authHeader(cookToken)).send({ isAvailable: false });

    const res = await request
      .post('/api/orders')
      .set(authHeader(buyerToken))
      .send({ addressText: 'Черкаси' });
    expect(res.status).toBe(409);
  });

  it('requires a delivery address', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const res = await request.post('/api/orders').set(authHeader(buyerToken)).send({});
    expect(res.status).toBe(400);
  });

  it('shows the order to the cook and lets them advance the status', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const order = await request
      .post('/api/orders')
      .set(authHeader(buyerToken))
      .send({ addressText: 'Черкаси' });
    const id = order.body.order.id;

    const incoming = await request.get('/api/cook/orders').set(authHeader(cookToken));
    expect(incoming.body.total).toBe(1);
    expect(incoming.body.orders[0].buyer.name).toBeTruthy();

    for (const status of ['PREPARING', 'READY', 'HANDED_OVER', 'COMPLETED']) {
      const r = await request
        .patch(`/api/cook/orders/${id}/status`)
        .set(authHeader(cookToken))
        .send({ status });
      expect(r.status).toBe(200);
      expect(r.body.order.status).toBe(status);
    }
  });

  it('rejects an invalid status transition', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const order = await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси' });
    const id = order.body.order.id;
    const res = await request
      .patch(`/api/cook/orders/${id}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'COMPLETED' }); // NEW → COMPLETED not allowed
    expect(res.status).toBe(400);
  });

  it('prevents a cook from touching another cook’s order', async () => {
    const a = await cookWithDish();
    const other = await registerActiveCook();
    const buyerToken = await buyerWithCart(a.dishId);
    const order = await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси' });

    const res = await request
      .patch(`/api/cook/orders/${order.body.order.id}/status`)
      .set(authHeader(other.accessToken))
      .send({ status: 'PREPARING' });
    expect(res.status).toBe(404);
  });

  it('reports dashboard stats', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId, 3);
    await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси' });

    const stats = await request.get('/api/cook/stats').set(authHeader(cookToken));
    expect(stats.status).toBe(200);
    expect(stats.body.ordersTotal).toBe(1);
    expect(stats.body.revenueTotal).toBe(270);
    expect(stats.body.topDishes[0]).toMatchObject({ name: 'Борщ', qty: 3 });
    expect(stats.body.newCount).toBe(1);
  });
});
