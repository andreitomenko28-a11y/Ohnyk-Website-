// Notifications (Phase 6.3).
//
// Every notification is persisted (the in-app centre always works), pushed live
// to the user's socket room, and — if the user linked Telegram — mirrored there.
// The order/new-order helpers keep their original signatures so existing call
// sites (payment, cook, courier controllers) need no change.
import { prisma } from './prisma.js';
import { emitNotification } from '../realtime/hub.js';
import { sendTelegram } from './telegram.js';
import { logger } from './logger.js';

export function serializeNotification(n) {
  return { id: n.id, type: n.type, payload: n.payload, read: n.read, createdAt: n.createdAt };
}

// Persist + live-push + external mirror. Best-effort on the external channel.
export async function createNotification({ userId, type, payload }) {
  if (!userId) return null;
  const n = await prisma.notification.create({ data: { userId, type, payload } });
  emitNotification(userId, serializeNotification(n));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
  if (user?.telegramChatId) {
    sendTelegram(user.telegramChatId, `${payload.title}\n${payload.body ?? ''}`.trim()).catch(() => {});
  }
  return n;
}

// Human-readable status line (used for Telegram + as an in-app fallback).
const STATUS_TEXT = {
  NEW: 'Замовлення оплачено',
  CONFIRMED: 'Кухар прийняв замовлення',
  PREPARING: 'Кухар готує замовлення',
  READY: 'Замовлення готове',
  COURIER_ASSIGNED: 'Кур’єр прийняв замовлення',
  PICKED_UP: 'Кур’єр забрав замовлення',
  ON_THE_WAY: 'Кур’єр прямує до вас',
  DELIVERED: 'Замовлення доставлено',
  CANCELLED: 'Замовлення скасовано',
};

// A new paid order — notify the cook.
export async function notifyNewOrder({ cook, order }) {
  logger.info('notify:new-order', { orderId: order.id, cookId: cook?.id ?? order.cookId, total: order.total });
  const cookUserId =
    cook?.userId ?? (await prisma.cook.findUnique({ where: { id: order.cookId }, select: { userId: true } }))?.userId;
  await createNotification({
    userId: cookUserId,
    type: 'NEW_ORDER',
    payload: { orderId: order.id, title: 'Нове замовлення', body: `Замовлення на ${order.total}₴` },
  });
  return { delivered: true, channel: 'inapp' };
}

// The order status advanced — notify the buyer.
export async function notifyOrderStatus({ order }) {
  logger.info('notify:order-status', { orderId: order.id, status: order.status });
  await createNotification({
    userId: order.buyerId,
    type: 'ORDER_STATUS',
    payload: {
      orderId: order.id,
      status: order.status,
      title: 'Оновлення замовлення',
      body: STATUS_TEXT[order.status] ?? order.status,
    },
  });
  return { delivered: true, channel: 'inapp' };
}
