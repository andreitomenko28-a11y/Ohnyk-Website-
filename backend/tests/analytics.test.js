import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, createAdmin, authHeader } from './helpers.js';

// Places a PICKUP order and drives it through payment to a revenue-counting
// state. Returns the order total.
async function paidOrder(cookToken, dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 2 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, 1', deliveryMethod: 'PICKUP' });
  const id = order.body.order.id;
  await request.post(`/api/orders/${id}/pay`).set(authHeader(buyer.accessToken)).send({});
  await request.post(`/api/orders/${id}/pay/mock`).set(authHeader(buyer.accessToken)).send({ result: 'success' });
  return order.body.order;
}

describe('Admin analytics (Module 7.2)', () => {
  it('forbids non-admins', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    expect((await request.get('/api/admin/analytics').set(authHeader(user.accessToken))).status).toBe(403);
  });

  it('aggregates orders, GMV, commission and active cooks', async () => {
    const admin = await createAdmin();
    const { accessToken: cookToken } = await registerActiveCook();
    const dish = await request.post('/api/cook/dishes').set(authHeader(cookToken)).send({ name: 'Борщ', price: 100 });
    const o1 = await paidOrder(cookToken, dish.body.dish.id);
    const o2 = await paidOrder(cookToken, dish.body.dish.id);

    const res = await request.get('/api/admin/analytics?period=30d').set(authHeader(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.totals.orders).toBeGreaterThanOrEqual(2);
    expect(res.body.totals.gmv).toBeGreaterThanOrEqual(o1.total + o2.total);
    expect(res.body.totals.commission).toBeGreaterThan(0);
    expect(res.body.totals.commission).toBeLessThan(res.body.totals.gmv);
    expect(res.body.totals.activeCooks).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.series.length).toBeGreaterThan(0);
    expect(res.body.series[0]).toHaveProperty('date');
  });

  it('excludes unpaid (AWAITING_PAYMENT) orders from revenue', async () => {
    const admin = await createAdmin();
    const { accessToken: cookToken } = await registerActiveCook();
    const dish = await request.post('/api/cook/dishes').set(authHeader(cookToken)).send({ name: 'Борщ', price: 100 });

    const before = (await request.get('/api/admin/analytics?period=30d').set(authHeader(admin.accessToken))).body.totals;

    // an unpaid order — must not move revenue totals
    const buyer = await registerUser({ role: 'CUSTOMER' });
    await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId: dish.body.dish.id, quantity: 1 });
    await request.post('/api/orders').set(authHeader(buyer.accessToken)).send({ addressText: 'Черкаси, 2', deliveryMethod: 'PICKUP' });

    const after = (await request.get('/api/admin/analytics?period=30d').set(authHeader(admin.accessToken))).body.totals;
    expect(after.gmv).toBe(before.gmv);
    expect(after.orders).toBe(before.orders);
  });

  it('supports period=all and a custom date range', async () => {
    const admin = await createAdmin();
    const all = await request.get('/api/admin/analytics?period=all').set(authHeader(admin.accessToken));
    expect(all.status).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    const custom = await request
      .get(`/api/admin/analytics?dateFrom=${today}&dateTo=${today}T23:59:59Z`)
      .set(authHeader(admin.accessToken));
    expect(custom.status).toBe(200);
    expect(custom.body.range.period).toBe('custom');
  });
});
