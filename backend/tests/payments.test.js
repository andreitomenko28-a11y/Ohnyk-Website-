import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';

// Verified cook with one dish.
async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request
    .post('/api/cook/dishes')
    .set(authHeader(accessToken))
    .send({ name: 'Борщ', price: 90 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// Buyer who has placed an order (awaiting payment). Returns { token, orderId }.
async function buyerWithOrder(dishId, quantity = 2) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, вул. Тестова, 1' });
  return { token: buyer.accessToken, orderId: order.body.order.id };
}

describe('Payment — MonoPay (Module 4.2)', () => {
  it('creates a stub invoice for an awaiting-payment order', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);

    const res = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.stub).toBe(true);
    expect(res.body.invoiceId).toMatch(/^stub_/);
    expect(res.body.pageUrl).toContain(`/pay/${orderId}`);

    const status = await request.get(`/api/orders/${orderId}/payment`).set(authHeader(token));
    expect(status.body.orderStatus).toBe('AWAITING_PAYMENT');
    expect(status.body.payment.status).toBe('PENDING');
  });

  it('marks the order NEW (visible to the cook) after a successful mock payment', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));

    const paid = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ result: 'success' });
    expect(paid.status).toBe(200);
    expect(paid.body.payment.status).toBe('SUCCESS');
    expect(paid.body.orderStatus).toBe('NEW');

    // The paid order now reaches the cook dashboard.
    const incoming = await request.get('/api/cook/orders').set(authHeader(cookToken));
    expect(incoming.body.total).toBe(1);
  });

  it('keeps the order awaiting payment after a failed mock payment', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));

    const failed = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ result: 'failure' });
    expect(failed.status).toBe(200);
    expect(failed.body.payment.status).toBe('FAILED');

    const status = await request.get(`/api/orders/${orderId}/payment`).set(authHeader(token));
    expect(status.body.orderStatus).toBe('AWAITING_PAYMENT');

    // Cook still can't see an unpaid order.
    const incoming = await request.get('/api/cook/orders').set(authHeader(cookToken));
    expect(incoming.body.total).toBe(0);
  });

  it('allows retrying payment after a failure', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    await request.post(`/api/orders/${orderId}/pay/mock`).set(authHeader(token)).send({ result: 'failure' });

    // Re-init succeeds (order still AWAITING_PAYMENT) and then can be paid.
    const reinit = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    expect(reinit.status).toBe(200);
    const paid = await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(token))
      .send({ result: 'success' });
    expect(paid.body.orderStatus).toBe('NEW');
  });

  it('refuses to pay an order that is already paid', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    await request.post(`/api/orders/${orderId}/pay/mock`).set(authHeader(token)).send({ result: 'success' });

    const res = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    expect(res.status).toBe(409);
  });

  it('forbids paying for someone else’s order', async () => {
    const { dishId } = await cookWithDish();
    const { orderId } = await buyerWithOrder(dishId);
    const stranger = await registerUser({ role: 'CUSTOMER' });
    const res = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(stranger.accessToken));
    expect(res.status).toBe(404);
  });

  it('rejects a webhook with a missing or invalid signature', async () => {
    const noSign = await request
      .post('/api/payments/webhook')
      .send({ invoiceId: 'x', status: 'success' });
    expect(noSign.status).toBe(400);

    const badSign = await request
      .post('/api/payments/webhook')
      .set('X-Sign', Buffer.from('not-valid').toString('base64'))
      .send({ invoiceId: 'x', status: 'success' });
    expect(badSign.status).toBe(400);
  });
});
