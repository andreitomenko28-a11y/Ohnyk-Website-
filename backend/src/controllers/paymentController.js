import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { notifyNewOrder } from '../lib/notify.js';
import { mockPaymentSchema } from '../validation/schemas.js';
import {
  isStub,
  createInvoice,
  mapInvoiceStatus,
  verifyWebhook,
} from '../lib/monopay.js';
import {
  findPaymentForInvoice,
  recordInvoice,
  resolvePaymentStatus,
  reusableInvoice,
} from '../lib/payments.js';

// Apply a payment result to an order + its Payment row. Idempotent: a repeated
// SUCCESS (webhook retries) won't re-notify or re-advance the order.
async function applyPaymentResult({ payment, monoStatus, transactionId, raw }) {
  const mapped = mapInvoiceStatus(monoStatus);

  const { order, effective } = await prisma.$transaction(async (tx) => {
    const cur = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!cur) return { order: null, effective: mapped.payment };

    // Never let a late/duplicate/out-of-order callback walk the payment
    // backwards — see resolvePaymentStatus for the rules.
    const next = resolvePaymentStatus(cur.status, mapped.payment);
    if (next !== mapped.payment) {
      return { order: null, effective: next };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: next,
        ...(next === 'REFUNDED' && !cur.refundedAt ? { refundedAt: new Date() } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(raw ? { rawCallback: raw } : {}),
      },
    });

    // Advance the order to NEW only on the first confirmed payment.
    if (mapped.paid) {
      const current = await tx.order.findUnique({ where: { id: payment.orderId } });
      if (current && current.status === 'AWAITING_PAYMENT') {
        const updated = await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'NEW' },
          include: {
            items: true,
            cook: { include: { user: { select: { fullName: true } } } },
          },
        });
        await tx.orderEvent.create({ data: { orderId: payment.orderId, status: 'NEW' } });
        return { order: updated, effective: mapped.payment };
      }
    }
    return { order: null, effective: mapped.payment };
  });

  // Notify the cook outside the transaction (best-effort).
  if (order) {
    await notifyNewOrder({ cook: order.cook, order }).catch(() => {});
  }
  return { payment: effective, paid: mapped.paid && effective === 'SUCCESS' };
}

// POST /api/orders/:id/pay — create (or reuse) a MonoPay invoice for an order.
export async function initPayment(req, res, next) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true },
    });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    if (order.status !== 'AWAITING_PAYMENT') throw httpError(409, 'Замовлення вже оплачено або недоступне для оплати');

    // One Payment per order; reuse the row across retries.
    const payment =
      order.payment ??
      (await prisma.payment.create({
        data: { orderId: order.id, amount: order.total, status: 'PENDING', provider: 'monopay' },
      }));

    // Send the buyer back to the invoice they already have rather than minting
    // a second one. Two live invoices for one order means the buyer can pay
    // either, and every extra invoice is another way for the two sides to
    // disagree about what was paid.
    const existing = await reusableInvoice(payment.id);
    if (existing) {
      return res.json({ pageUrl: existing.pageUrl, invoiceId: existing.invoiceId, stub: isStub() });
    }

    const { invoiceId, pageUrl } = await createInvoice({
      amount: order.total,
      orderId: order.id,
      reference: order.id,
      destination: 'Замовлення Ohnyk',
    });

    // Recorded in the ledger, so a callback for this invoice stays resolvable
    // even after a later one supersedes it.
    await recordInvoice({ paymentId: payment.id, invoiceId, pageUrl });

    res.json({ pageUrl, invoiceId, stub: isStub() });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id/payment — current payment/order status (for polling).
export async function getPaymentStatus(req, res, next) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true, cook: { include: { user: { select: { fullName: true } } } } },
    });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    res.json({
      orderStatus: order.status,
      total: order.total,
      cookName: order.cook?.displayName || order.cook?.user?.fullName || '',
      payment: order.payment ? { status: order.payment.status } : null,
      stub: isStub(),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders/:id/pay/mock — dev-only: simulate the gateway result.
// Enabled only in stub mode (no MONO_TOKEN); a no-op door in production.
export async function mockComplete(req, res, next) {
  try {
    if (!isStub()) throw httpError(404, 'Not found');
    // Validated rather than coerced: silently reading an undeclared field as
    // "success" is how a client asking for a failure got a paid order.
    const { result } = mockPaymentSchema.parse(req.body ?? {});

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true },
    });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    if (!order.payment) throw httpError(400, 'Оплату не ініційовано');

    const mapped = await applyPaymentResult({
      payment: order.payment,
      monoStatus: result, // 'success' | 'failure'
      transactionId: `stub_txn_${Date.now()}`,
      raw: { stub: true, result },
    });

    res.json({ payment: { status: mapped.payment }, orderStatus: mapped.paid ? 'NEW' : order.status });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/webhook — monobank server-to-server callback.
// Unauthenticated but signature-verified. Always ack 200 for authentic,
// already-processed, or unknown-invoice calls so monobank stops retrying.
export async function webhook(req, res, next) {
  try {
    const valid = await verifyWebhook(req.rawBody, req.get('X-Sign'));
    if (!valid) throw httpError(400, 'Невірний підпис');

    const { invoiceId, status, reference } = req.body || {};
    if (!invoiceId) return res.json({ ok: true });

    // Resolved through the invoice ledger, so a callback for an invoice that a
    // later "pay" tap superseded still finds its payment.
    const payment = await findPaymentForInvoice(invoiceId);
    if (!payment) return res.json({ ok: true }); // unknown invoice — ack and ignore

    await applyPaymentResult({
      payment,
      monoStatus: status,
      transactionId: reference,
      raw: req.body,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
