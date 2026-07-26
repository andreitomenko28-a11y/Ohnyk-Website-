// Refunds owed to buyers.
//
// Cancelling an order that was already paid leaves the buyer's money with us.
// There is no automatic reversal yet, so the debt is recorded instead of being
// silently dropped: the payment moves to REFUND_PENDING and an admin settles it
// by hand (GET /api/admin/refunds → POST /api/admin/refunds/:id/complete).
//
// Recording it is not optional bookkeeping — a cancelled paid order that leaves
// no trace is money taken for nothing, and nobody finds out except the buyer.

import { prisma } from './prisma.js';
import { CAPTURED } from './payments.js';

// Marks the order's payment as owing a refund. Returns the payment when one was
// marked, null when there is nothing to refund (unpaid, already refunded, or an
// order that never had a payment at all).
//
// Takes a transaction client so the mark and the cancellation commit together:
// a cancelled order must never exist without its refund marker.
export async function markRefundDue(orderId, reason, db = prisma) {
  const payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment || !CAPTURED.includes(payment.status)) return null;

  return db.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUND_PENDING', refundReason: reason || null },
  });
}

// Settles a pending refund once the money has actually been sent back.
export async function completeRefund({ paymentId, adminId }, db = prisma) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, reason: 'not_found' };
  if (payment.status === 'REFUNDED') return { ok: false, reason: 'already_refunded' };
  if (payment.status !== 'REFUND_PENDING') return { ok: false, reason: 'not_pending' };

  const updated = await db.payment.update({
    where: { id: paymentId },
    data: { status: 'REFUNDED', refundedAt: new Date(), refundedByAdminId: adminId },
  });
  return { ok: true, payment: updated };
}
