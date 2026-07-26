import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

// Regressions for the remaining audit findings. Each one was reproducible
// against a running server and passed every existing test.

async function adminSession() {
  const admin = await registerUser({ role: 'CUSTOMER' });
  await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  const login = await request
    .post('/api/auth/login')
    .send({ identifier: admin.user.email, password: admin.password });
  return { id: admin.user.id, email: admin.user.email, token: login.body.accessToken };
}

async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request
    .post('/api/cook/dishes')
    .set(authHeader(accessToken))
    .send({ name: 'Борщ', price: 100 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// A READY order waiting for a courier.
async function readyOrder(cookToken, dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, вул. Тестова, 1', deliveryMethod: 'COURIER' });
  const id = order.body.order.id;
  await request.post(`/api/orders/${id}/pay`).set(authHeader(buyer.accessToken));
  await request.post(`/api/orders/${id}/pay/mock`).set(authHeader(buyer.accessToken)).send({ result: 'success' });
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'PREPARING' });
  await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status: 'READY' });
  return id;
}

describe('Role comes from the database, not the token', () => {
  it('revokes admin access the moment the role is taken away', async () => {
    const admin = await adminSession();
    expect((await request.get('/api/admin/users').set(authHeader(admin.token))).status).toBe(200);

    // The access token still says ADMIN and is still valid for ~15 minutes.
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'CUSTOMER' } });

    const after = await request.get('/api/admin/users').set(authHeader(admin.token));
    expect(after.status).toBe(403);
  });

  it('grants a promotion on the existing token too', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    expect((await request.get('/api/admin/users').set(authHeader(user.accessToken))).status).toBe(403);

    await prisma.user.update({ where: { id: user.user.id }, data: { role: 'ADMIN' } });
    expect((await request.get('/api/admin/users').set(authHeader(user.accessToken))).status).toBe(200);
  });
});

describe('A courier holds one delivery at a time', () => {
  it('refuses a second claim while one is running', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const first = await readyOrder(cookToken, dishId);
    const second = await readyOrder(cookToken, dishId);

    const courier = await registerUser({ role: 'COURIER', transport: 'BICYCLE' });
    await request.patch('/api/courier/status').set(authHeader(courier.accessToken)).send({ status: 'ONLINE' });

    expect((await request.post(`/api/courier/orders/${first}/claim`).set(authHeader(courier.accessToken))).status).toBe(200);

    const res = await request.post(`/api/courier/orders/${second}/claim`).set(authHeader(courier.accessToken));
    expect(res.status).toBe(409);

    // The second order is still on the board for someone else.
    const board = await request.get('/api/courier/orders/available').set(authHeader(courier.accessToken));
    expect(board.body.orders.some((o) => o.id === second)).toBe(true);
  });

  it('lets them take the next one after finishing', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const first = await readyOrder(cookToken, dishId);
    const second = await readyOrder(cookToken, dishId);

    const courier = await registerUser({ role: 'COURIER', transport: 'BICYCLE' });
    const auth = authHeader(courier.accessToken);
    await request.patch('/api/courier/status').set(auth).send({ status: 'ONLINE' });
    await request.post(`/api/courier/orders/${first}/claim`).set(auth);

    for (const status of ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']) {
      await request.patch(`/api/courier/orders/${first}/status`).set(auth).send({ status });
    }

    expect((await request.post(`/api/courier/orders/${second}/claim`).set(auth)).status).toBe(200);
  });

  it('refuses to go offline mid-delivery', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const orderId = await readyOrder(cookToken, dishId);

    const courier = await registerUser({ role: 'COURIER', transport: 'BICYCLE' });
    const auth = authHeader(courier.accessToken);
    await request.patch('/api/courier/status').set(auth).send({ status: 'ONLINE' });
    await request.post(`/api/courier/orders/${orderId}/claim`).set(auth);

    // Going offline here would strand the buyer: still assigned, map silent,
    // and no other courier can pick it up.
    expect((await request.patch('/api/courier/status').set(auth).send({ status: 'OFFLINE' })).status).toBe(409);

    await request.patch(`/api/courier/orders/${orderId}/status`).set(auth).send({ status: 'PICKED_UP' });
    await request.patch(`/api/courier/orders/${orderId}/status`).set(auth).send({ status: 'ON_THE_WAY' });
    await request.patch(`/api/courier/orders/${orderId}/status`).set(auth).send({ status: 'DELIVERED' });

    expect((await request.patch('/api/courier/status').set(auth).send({ status: 'OFFLINE' })).status).toBe(200);
  });
});

describe('The stub payment endpoint validates its body', () => {
  async function awaitingOrder() {
    const { dishId } = await cookWithDish();
    const buyer = await registerUser({ role: 'CUSTOMER' });
    await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
    const order = await request
      .post('/api/orders')
      .set(authHeader(buyer.accessToken))
      .send({ addressText: 'Черкаси, вул. Тестова, 1' });
    const id = order.body.order.id;
    await request.post(`/api/orders/${id}/pay`).set(authHeader(buyer.accessToken));
    return { token: buyer.accessToken, orderId: id };
  }

  it('rejects the field name the mobile client used to send', async () => {
    // `{status:'failure'}` used to be read as a success and paid the order.
    const { token, orderId } = await awaitingOrder();
    const res = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ status: 'failure' });

    expect(res.status).toBe(400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe('AWAITING_PAYMENT');
  });

  it('honours an explicit failure', async () => {
    const { token, orderId } = await awaitingOrder();
    const res = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ result: 'failure' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('FAILED');
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe('AWAITING_PAYMENT');
  });

  it('still pays on an explicit success', async () => {
    const { token, orderId } = await awaitingOrder();
    const res = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ result: 'success' });

    expect(res.body.payment.status).toBe('SUCCESS');
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe('NEW');
  });
});

describe('One cook per cart survives concurrent adds', () => {
  it('rejects the loser of a race instead of mixing two cooks', async () => {
    const a = await cookWithDish();
    const b = await cookWithDish();
    const buyer = await registerUser({ role: 'CUSTOMER' });
    const auth = authHeader(buyer.accessToken);

    // Both requests read an empty cart before either writes cookId.
    const results = await Promise.allSettled([
      request.post('/api/cart/add').set(auth).send({ dishId: a.dishId, quantity: 1 }),
      request.post('/api/cart/add').set(auth).send({ dishId: b.dishId, quantity: 1 }),
    ]);
    const codes = results.map((r) => r.value?.status).sort();
    expect(codes).toContain(201);

    // Whatever the ordering, the cart must hold exactly one cook's dishes.
    const cart = await request.get('/api/cart').set(auth);
    const cookIds = new Set(cart.body.cart.items.map((i) => i.dish.cookId));
    expect(cookIds.size).toBe(1);
    expect([a.cookId, b.cookId]).toContain(cart.body.cart.cookId);
  });
});
