import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { resolvePaymentStatus } from '../src/lib/payments.js';
import { findPaymentForInvoice, reusableInvoice, INVOICE_REUSE_MS } from '../src/lib/payments.js';

async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request
    .post('/api/cook/dishes')
    .set(authHeader(accessToken))
    .send({ name: 'Борщ', price: 100 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

async function buyerWithOrder(dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, вул. Тестова, 1' });
  return { token: buyer.accessToken, userId: buyer.user.id, orderId: order.body.order.id };
}

// A paid order, ready to be cancelled.
async function paidOrder() {
  const { cookToken, dishId } = await cookWithDish();
  const { token, userId, orderId } = await buyerWithOrder(dishId);
  await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
  await request.post(`/api/orders/${orderId}/pay/mock`).set(authHeader(token)).send({ result: 'success' });
  return { cookToken, token, userId, orderId };
}

async function adminToken() {
  const admin = await registerUser({ role: 'CUSTOMER' });
  await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  const login = await request
    .post('/api/auth/login')
    .send({ identifier: admin.user.email, password: admin.password });
  return login.body.accessToken;
}

describe('Invoice ledger — a second "pay" must not orphan the first invoice', () => {
  it('offers the invoice already issued instead of minting another', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);

    const first = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    const second = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));

    // The "retry" button on the payment page lands the buyer back on the same
    // page rather than on a second live invoice for the same order.
    expect(second.body.invoiceId).toBe(first.body.invoiceId);
    expect(second.body.pageUrl).toBe(first.body.pageUrl);

    const invoices = await prisma.paymentInvoice.count({
      where: { payment: { orderId } },
    });
    expect(invoices).toBe(1);
  });

  it('resolves a callback for a superseded invoice', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    const stale = await prisma.paymentInvoice.findFirst({ where: { paymentId: payment.id } });

    // Age the invoice past the reuse window, then ask for payment again — this
    // is the path that used to overwrite providerInvoiceId and lose the first.
    await prisma.paymentInvoice.update({
      where: { id: stale.id },
      data: { createdAt: new Date(Date.now() - INVOICE_REUSE_MS - 1000) },
    });
    const fresh = await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    expect(fresh.body.invoiceId).not.toBe(stale.invoiceId);

    // The webhook's lookup: the OLD invoice still resolves to its payment, so a
    // buyer who paid the first link is not silently ignored.
    const viaOld = await findPaymentForInvoice(stale.invoiceId);
    expect(viaOld?.id).toBe(payment.id);
    const viaNew = await findPaymentForInvoice(fresh.body.invoiceId);
    expect(viaNew?.id).toBe(payment.id);
  });

  it('stops reusing an invoice once it is stale', async () => {
    const { dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    expect(await reusableInvoice(payment.id)).not.toBeNull();
    expect(await reusableInvoice(payment.id, Date.now() + INVOICE_REUSE_MS + 1)).toBeNull();
  });
});

describe('Payment status may never walk backwards', () => {
  it('keeps a captured payment captured', () => {
    expect(resolvePaymentStatus('SUCCESS', 'PENDING')).toBe('SUCCESS');
    expect(resolvePaymentStatus('SUCCESS', 'FAILED')).toBe('SUCCESS');
    expect(resolvePaymentStatus('SUCCESS', 'REFUNDED')).toBe('REFUNDED');
  });

  it('does not let a late success erase a refund we owe', () => {
    // The order was cancelled after payment; a duplicate "success" callback for
    // the same invoice must not make the debt disappear.
    expect(resolvePaymentStatus('REFUND_PENDING', 'SUCCESS')).toBe('REFUND_PENDING');
    expect(resolvePaymentStatus('REFUND_PENDING', 'PENDING')).toBe('REFUND_PENDING');
    expect(resolvePaymentStatus('REFUND_PENDING', 'REFUNDED')).toBe('REFUNDED');
  });

  it('treats a refund as terminal, and leaves fresh payments alone', () => {
    expect(resolvePaymentStatus('REFUNDED', 'SUCCESS')).toBe('REFUNDED');
    expect(resolvePaymentStatus('PENDING', 'SUCCESS')).toBe('SUCCESS');
    expect(resolvePaymentStatus('PENDING', 'FAILED')).toBe('FAILED');
  });
});

describe('Cancelling a paid order records the refund it owes', () => {
  it('parks the payment in REFUND_PENDING', async () => {
    const { cookToken, orderId } = await paidOrder();

    const res = await request
      .patch(`/api/cook/orders/${orderId}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.refundPending).toBe(true);

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment.status).toBe('REFUND_PENDING');
    expect(payment.refundReason).toBeTruthy();
    expect(payment.refundedAt).toBeNull();
  });

  it('leaves an unpaid cancellation alone', async () => {
    // No money changed hands, so there is nothing to give back.
    const { cookToken, dishId } = await cookWithDish();
    const { token, orderId } = await buyerWithOrder(dishId);
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(token));
    await prisma.order.update({ where: { id: orderId }, data: { status: 'NEW' } });

    const res = await request
      .patch(`/api/cook/orders/${orderId}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'CANCELLED' });

    expect(res.body.refundPending).toBe(false);
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment.status).toBe('PENDING');
  });

  it('does not mark a refund twice', async () => {
    const { orderId } = await paidOrder();
    const { markRefundDue } = await import('../src/lib/refunds.js');

    expect(await markRefundDue(orderId, 'first')).not.toBeNull();
    // Already owed — a second call must not overwrite the original reason.
    expect(await markRefundDue(orderId, 'second')).toBeNull();
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment.refundReason).toBe('first');
  });
});

describe('Admin refund queue', () => {
  it('lists what is owed and settles it', async () => {
    const token = await adminToken();
    const { cookToken, orderId, userId } = await paidOrder();
    await request
      .patch(`/api/cook/orders/${orderId}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'CANCELLED' });

    const queue = await request.get('/api/admin/refunds').set(authHeader(token));
    expect(queue.status).toBe(200);
    const row = queue.body.refunds.find((r) => r.orderId === orderId);
    expect(row).toBeTruthy();
    expect(row.amount).toBeGreaterThan(0);
    expect(row.buyer.id).toBe(userId);
    expect(queue.body.owed).toBeGreaterThanOrEqual(row.amount);

    const done = await request
      .post(`/api/admin/refunds/${row.paymentId}/complete`)
      .set(authHeader(token))
      .send({ note: 'переказ 12345' });
    expect(done.status).toBe(200);
    expect(done.body.refund.status).toBe('REFUNDED');

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment.refundedAt).not.toBeNull();
    expect(payment.refundedByAdminId).toBeTruthy();

    // Settling it twice is refused rather than silently repeated.
    const again = await request
      .post(`/api/admin/refunds/${row.paymentId}/complete`)
      .set(authHeader(token));
    expect(again.status).toBe(409);

    // And it has left the queue.
    const after = await request.get('/api/admin/refunds').set(authHeader(token));
    expect(after.body.refunds.find((r) => r.orderId === orderId)).toBeUndefined();

    // The buyer is told their money came back.
    const notes = await prisma.notification.findMany({ where: { userId } });
    expect(notes.some((n) => n.payload?.title === 'Кошти повернено')).toBe(true);
  });

  it('refuses to settle a payment that owes nothing', async () => {
    const token = await adminToken();
    const { orderId } = await paidOrder(); // paid, never cancelled
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    const res = await request
      .post(`/api/admin/refunds/${payment.id}/complete`)
      .set(authHeader(token));
    expect(res.status).toBe(409);
  });

  it('is admin-only', async () => {
    const buyer = await registerUser({ role: 'CUSTOMER' });
    expect((await request.get('/api/admin/refunds').set(authHeader(buyer.accessToken))).status).toBe(403);
    expect((await request.get('/api/admin/refunds')).status).toBe(401);
  });

  it('rejects an undeclared field on complete (schema is strict)', async () => {
    const token = await adminToken();
    const { cookToken, orderId } = await paidOrder();
    await request
      .patch(`/api/cook/orders/${orderId}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'CANCELLED' });
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    const res = await request
      .post(`/api/admin/refunds/${payment.id}/complete`)
      .set(authHeader(token))
      .send({ note: 'ok', amount: 1 });
    expect(res.status).toBe(400);
  });
});
