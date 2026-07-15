import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader, payOrder } from './helpers.js';

async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(accessToken)).send({ name: 'Борщ', price: 90 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// Buyer with a dish in the cart. Returns the buyer token.
async function buyerWithCart(dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  return buyer.accessToken;
}

// Register an ONLINE courier. Returns the token.
async function onlineCourier() {
  const res = await request.post('/api/auth/register').send({
    fullName: 'Кур’єр Тест',
    email: `courier_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@ohnyk.app`,
    phone: `+38067${Math.floor(1000000 + Math.random() * 8999999)}`,
    password: 'password123',
    role: 'COURIER',
    transport: 'BICYCLE',
  });
  await request.patch('/api/courier/status').set(authHeader(res.body.accessToken)).send({ status: 'ONLINE' });
  return res.body.accessToken;
}

// Place + pay + bring to READY. Returns order id.
async function readyOrder(cookToken, dishId, buyerToken, deliveryMethod) {
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyerToken))
    .send({ deliveryMethod, addressText: 'Черкаси, вул. Тестова, 1' });
  const id = order.body.order.id;
  await payOrder(id);
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'PREPARING' });
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'READY' });
  return { id, order: order.body.order };
}

describe('Delivery methods (Module 4.3b)', () => {
  it('pickup uses the cook’s kitchen address and needs no buyer address', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId); // buyer has NO saved address

    const res = await request.post('/api/orders').set(authHeader(buyerToken)).send({ deliveryMethod: 'PICKUP' });
    expect(res.status).toBe(201);
    expect(res.body.order.deliveryMethod).toBe('PICKUP');
    expect(res.body.order.addressText).toContain('Тестова'); // cook kitchen address
  });

  it('still requires an address for courier delivery without one', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const res = await request.post('/api/orders').set(authHeader(buyerToken)).send({ deliveryMethod: 'COURIER' });
    expect(res.status).toBe(400);
  });

  it('lets the cook hand a pickup order to the customer (READY → DELIVERED)', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const { id } = await readyOrder(cookToken, dishId, buyerToken, 'PICKUP');

    const done = await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'DELIVERED' });
    expect(done.status).toBe(200);
    expect(done.body.order.status).toBe('DELIVERED');
  });

  it('lets the cook deliver themselves (READY → ON_THE_WAY → DELIVERED)', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const { id } = await readyOrder(cookToken, dishId, buyerToken, 'COOK_DELIVERY');

    for (const status of ['ON_THE_WAY', 'DELIVERED']) {
      const r = await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status });
      expect(r.status).toBe(200);
      expect(r.body.order.status).toBe(status);
    }
  });

  it('does not allow the cook to skip to ON_THE_WAY on a courier order', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const { id } = await readyOrder(cookToken, dishId, buyerToken, 'COURIER');
    const r = await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'ON_THE_WAY' });
    expect(r.status).toBe(400);
  });

  it('shows only courier-method orders in the courier pool', async () => {
    const { cookToken, dishId } = await cookWithDish();
    // One of each method, all READY.
    const pickup = await readyOrder(cookToken, dishId, await buyerWithCart(dishId), 'PICKUP');
    const cook = await readyOrder(cookToken, dishId, await buyerWithCart(dishId), 'COOK_DELIVERY');
    const courier = await readyOrder(cookToken, dishId, await buyerWithCart(dishId), 'COURIER');

    const token = await onlineCourier();
    const avail = await request.get('/api/courier/orders/available').set(authHeader(token));
    const ids = avail.body.orders.map((o) => o.id);
    expect(ids).toContain(courier.id);
    expect(ids).not.toContain(pickup.id);
    expect(ids).not.toContain(cook.id);

    // A courier cannot claim a cook-delivery order even by id.
    const claim = await request.post(`/api/courier/orders/${cook.id}/claim`).set(authHeader(token));
    expect(claim.status).toBe(409);
  });
});
