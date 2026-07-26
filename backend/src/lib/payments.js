// Payment status rules and invoice bookkeeping.
//
// Both live here rather than in the controller because both are about one
// thing: a payment's history is written by parties we do not control (the
// gateway's callbacks, in whatever order they arrive) and must never be
// walked backwards by a late one.

import { prisma } from './prisma.js';

// How long an already-issued invoice is offered again instead of minting a new
// one. A buyer who taps "pay" twice should land on the same hosted page; only
// once that page is stale is a fresh invoice worth creating.
export const INVOICE_REUSE_MS = 60 * 60 * 1000;

// What a callback reporting `incoming` may do to a payment currently at
// `current`. Returns the status to store — possibly the current one, meaning
// "ignore this callback".
//
//   SUCCESS         money is captured; only a reversal moves it
//   REFUND_PENDING  we owe the buyer money; only the refund landing clears it,
//                   and a late "success" for the same invoice must not erase it
//   REFUNDED        terminal
export function resolvePaymentStatus(current, incoming) {
  switch (current) {
    case 'SUCCESS':
      return incoming === 'REFUNDED' ? 'REFUNDED' : 'SUCCESS';
    case 'REFUND_PENDING':
      return incoming === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return incoming;
  }
}

// Statuses where the buyer's money is with us and has not been sent back.
export const CAPTURED = ['SUCCESS'];

// Finds the payment a callback belongs to.
//
// Looks up the invoice ledger first, so a callback for *any* invoice ever
// issued for the payment resolves — including one superseded by a later "pay"
// tap. Falls back to the payment's own most-recent id for rows written before
// the ledger existed.
export async function findPaymentForInvoice(invoiceId, db = prisma) {
  if (!invoiceId) return null;
  const invoice = await db.paymentInvoice.findUnique({
    where: { invoiceId },
    include: { payment: true },
  });
  if (invoice?.payment) return invoice.payment;
  return db.payment.findFirst({ where: { providerInvoiceId: invoiceId } });
}

// The invoice to offer for a payment that is still awaiting money, or null when
// a fresh one should be created.
export async function reusableInvoice(paymentId, now = Date.now(), db = prisma) {
  const latest = await db.paymentInvoice.findFirst({
    where: { paymentId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) return null;
  return now - latest.createdAt.getTime() < INVOICE_REUSE_MS ? latest : null;
}

// Records an issued invoice and points the payment at it.
export async function recordInvoice({ paymentId, invoiceId, pageUrl }, db = prisma) {
  await db.paymentInvoice.create({ data: { paymentId, invoiceId, pageUrl } });
  await db.payment.update({
    where: { id: paymentId },
    data: { providerInvoiceId: invoiceId, status: 'PENDING' },
  });
}
