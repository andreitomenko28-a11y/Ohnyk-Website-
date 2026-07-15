import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader, payOrder } from './helpers.js';

// Register a courier (with profile) and return { token, courierId }.
async function registerCourier() {
  const res = await request.post('/api/auth/register').send({
    fullName: 'Кур’єр Тест',
    email: `courier_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@ohnyk.app`,
    phone: `+38067${Math.floor(1000000 + Math.random() * 8999999)}`,
    password: 'password123',
    role: 'COURIER',
    transport: 'BICYCLE',
  });
  return { token: res.body.accessToken, courier: res.body.user.courier };
}

// Verified cook + one dish.
async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(accessToken)).send({ name: 'Борщ', price: 90 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// A paid order advanced to READY. Returns { orderId }.
async function readyOrder(cookToken, dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  const order = await request.post('/api/orders').set(authHeader(buyer.accessToken)).send({ addressText: 'Черкаси, вул. Тестова, 1' });
  const id = order.body.order.id;
  await payOrder(id);
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'PREPARING' });
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'READY' });
  return { id, buyerToken: buyer.accessToken };
}

describe('Courier role & delivery (Module 4.3)', () => {
  it('registers a courier with a profile', async () => {
    const { token, courier } = await registerCourier();
    expect(courier).toMatchObject({ status: 'OFFLINE', transport: 'BICYCLE' });
    const me = await request.get('/api/courier/me').set(authHeader(token));
    expect(me.status).toBe(200);
    expect(me.body.courier.status).toBe('OFFLINE');
  });

  it('toggles availability online/offline', async () => {
    const { token } = await registerCourier();
    const on = await request.patch('/api/courier/status').set(authHeader(token)).send({ status: 'ONLINE' });
    expect(on.body.courier.status).toBe('ONLINE');
    const off = await request.patch('/api/courier/status').set(authHeader(token)).send({ status: 'OFFLINE' });
    expect(off.body.courier.status).toBe('OFFLINE');
  });

  it('requires the courier to be online before claiming', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { id } = await readyOrder(cookToken, dishId);
    const { token } = await registerCourier(); // still OFFLINE

    const res = await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(token));
    expect(res.status).toBe(409);
  });

  it('lets an online courier claim a READY order and run the delivery lifecycle', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { id, buyerToken } = await readyOrder(cookToken, dishId);
    const { token } = await registerCourier();
    await request.patch('/api/courier/status').set(authHeader(token)).send({ status: 'ONLINE' });

    // Appears in the available pool.
    const avail = await request.get('/api/courier/orders/available').set(authHeader(token));
    expect(avail.body.orders.some((o) => o.id === id)).toBe(true);

    // Claim → COURIER_ASSIGNED.
    const claim = await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(token));
    expect(claim.status).toBe(200);
    expect(claim.body.order.status).toBe('COURIER_ASSIGNED');
    expect(claim.body.order.courier.name).toBeTruthy();

    // Advance through the delivery statuses.
    for (const status of ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']) {
      const r = await request.patch(`/api/courier/orders/${id}/status`).set(authHeader(token)).send({ status });
      expect(r.status).toBe(200);
      expect(r.body.order.status).toBe(status);
    }

    // Buyer sees the assigned courier on their order.
    const buyerView = await request.get(`/api/orders/${id}`).set(authHeader(buyerToken));
    expect(buyerView.body.order.courier?.name).toBeTruthy();
    expect(buyerView.body.order.status).toBe('DELIVERED');
  });

  it('prevents two couriers from claiming the same order', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { id } = await readyOrder(cookToken, dishId);
    const a = await registerCourier();
    const b = await registerCourier();
    await request.patch('/api/courier/status').set(authHeader(a.token)).send({ status: 'ONLINE' });
    await request.patch('/api/courier/status').set(authHeader(b.token)).send({ status: 'ONLINE' });

    const first = await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(a.token));
    expect(first.status).toBe(200);
    const second = await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(b.token));
    expect(second.status).toBe(409);
  });

  it('rejects an invalid delivery transition and foreign-order access', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { id } = await readyOrder(cookToken, dishId);
    const owner = await registerCourier();
    const other = await registerCourier();
    await request.patch('/api/courier/status').set(authHeader(owner.token)).send({ status: 'ONLINE' });
    await request.post(`/api/courier/orders/${id}/claim`).set(authHeader(owner.token));

    // Skipping PICKED_UP is not allowed.
    const skip = await request.patch(`/api/courier/orders/${id}/status`).set(authHeader(owner.token)).send({ status: 'ON_THE_WAY' });
    expect(skip.status).toBe(400);

    // A different courier cannot touch someone else's delivery.
    const foreign = await request.patch(`/api/courier/orders/${id}/status`).set(authHeader(other.token)).send({ status: 'PICKED_UP' });
    expect(foreign.status).toBe(404);
  });

  it('forbids non-couriers from the courier API', async () => {
    const buyer = await registerUser({ role: 'CUSTOMER' });
    const res = await request.get('/api/courier/me').set(authHeader(buyer.accessToken));
    expect(res.status).toBe(403);
  });
});
