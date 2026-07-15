import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader, payOrder } from './helpers.js';

async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(accessToken)).send({ name: 'Борщ', price: 90 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

async function buyerWithCart(dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  return buyer.accessToken;
}

const statuses = (order) => order.timeline.map((e) => e.status);

describe('Order history & timeline (Module 4.5)', () => {
  it('records an AWAITING_PAYMENT event at checkout', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const res = await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси, 1' });
    expect(statuses(res.body.order)).toEqual(['AWAITING_PAYMENT']);
  });

  it('grows the timeline as the order advances through the cook', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const created = await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси, 1' });
    const id = created.body.order.id;

    await payOrder(id); // → NEW
    await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'PREPARING' });
    await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'READY' });

    const res = await request.get(`/api/orders/${id}`).set(authHeader(buyerToken));
    expect(statuses(res.body.order)).toEqual(['AWAITING_PAYMENT', 'NEW', 'PREPARING', 'READY']);
    // Timeline is chronological.
    const times = res.body.order.timeline.map((e) => new Date(e.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('lists the buyer’s own orders (newest first, unpaid excluded from ALL view)', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси, 1' });

    const res = await request.get('/api/orders').set(authHeader(buyerToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.orders[0].timeline.length).toBeGreaterThan(0);
  });

  it('records the full delivery timeline through the courier', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const created = await request
      .post('/api/orders')
      .set(authHeader(buyerToken))
      .send({ addressText: 'Черкаси, 1', deliveryMethod: 'COURIER' });
    const id = created.body.order.id;
    await payOrder(id);
    await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'PREPARING' });
    await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'READY' });

    const courier = await request.post('/api/auth/register').send({
      fullName: 'Кур’єр', email: `c_${Date.now()}@ohnyk.app`, phone: `+38067${Math.floor(1e6 + Math.random() * 9e6)}`,
      password: 'password123', role: 'COURIER', transport: 'CAR',
    });
    await request.patch('/api/courier/status').set(authHeader(courier.body.accessToken)).send({ status: 'ONLINE' });
    await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(courier.body.accessToken));
    for (const s of ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']) {
      await request.patch(`/api/courier/orders/${id}/status`).set(authHeader(courier.body.accessToken)).send({ status: s });
    }

    const res = await request.get(`/api/orders/${id}`).set(authHeader(buyerToken));
    expect(statuses(res.body.order)).toEqual([
      'AWAITING_PAYMENT', 'NEW', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED',
    ]);
  });

  it('does not expose another buyer’s order', async () => {
    const { dishId } = await cookWithDish();
    const buyerToken = await buyerWithCart(dishId);
    const created = await request.post('/api/orders').set(authHeader(buyerToken)).send({ addressText: 'Черкаси, 1' });
    const stranger = await registerUser({ role: 'CUSTOMER' });
    const res = await request.get(`/api/orders/${created.body.order.id}`).set(authHeader(stranger.accessToken));
    expect(res.status).toBe(404);
  });
});
