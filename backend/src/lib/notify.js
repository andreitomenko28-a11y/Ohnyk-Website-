// Notifications — STUB.
//
// New-order alerts to the cook are not delivered anywhere real yet. For now we
// just log them. The function signature is what the rest of the app depends on,
// so wiring a real channel later is a drop-in change here.
//
// TODO(Phase 4+): deliver via
//   - Push: Web Push / FCM (store the cook's device token, send on new order)
//   - Email: nodemailer / a transactional provider (Postmark, Resend)
//   - SMS: reuse lib/sms.js provider
// Consider a small outbox table + worker so delivery survives restarts.

export async function notifyNewOrder({ cook, order }) {
  // TODO: replace with real push/email delivery.
  console.log(
    `[notify:stub] new order ${order.id} for cook ${cook.id} — ${order.items?.length ?? 0} item(s), total ${order.total}₴`,
  );
  return { delivered: false, channel: 'stub' };
}

export async function notifyOrderStatus({ order }) {
  // TODO: notify the buyer when the cook advances the order status.
  console.log(`[notify:stub] order ${order.id} status → ${order.status}`);
  return { delivered: false, channel: 'stub' };
}
