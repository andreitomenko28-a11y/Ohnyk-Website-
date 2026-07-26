import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { deviceTokenSchema, deviceUnregisterSchema } from '../validation/schemas.js';
import { httpError } from '../middleware/errorHandler.js';
import { listNotificationsSchema } from '../validation/schemas.js';
import { serializeNotification } from '../lib/notify.js';
import { linkUrl, sendTelegram } from '../lib/telegram.js';

// GET /api/notifications?cursor=&limit= — the current user's notifications
// (newest first) plus the current unread count.
export async function listNotifications(req, res, next) {
  try {
    const { cursor, limit } = listNotificationsSchema.parse(req.query);
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ]);
    const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null;
    res.json({ notifications: items.map(serializeNotification), unreadCount, nextCursor });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/read-all — mark all of the user's notifications read.
export async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/:id/read — mark one notification read.
export async function markRead(req, res, next) {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { read: true },
    });
    if (result.count === 0) throw httpError(404, 'Сповіщення не знайдено');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/telegram/link — issue a one-time deep-link token the
// user opens in Telegram to connect their account.
export async function linkTelegram(req, res, next) {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({ where: { id: req.user.id }, data: { telegramLinkToken: token } });
    res.json({ url: linkUrl(token), token });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications/telegram — disconnect the Telegram channel.
export async function unlinkTelegram(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { telegramChatId: null, telegramLinkToken: null },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/telegram/status — whether the user has linked Telegram.
export async function telegramStatus(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramChatId: true },
    });
    res.json({ linked: !!user?.telegramChatId });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/telegram/webhook — Telegram Bot API update callback.
// Unauthenticated (called by Telegram servers); acts only on a valid /start
// <token>. Inert in stub mode (no bot), wired for when a token is configured.
export async function telegramWebhook(req, res, next) {
  try {
    const msg = req.body?.message;
    const text = msg?.text ?? '';
    const chatId = msg?.chat?.id;
    const match = /^\/start\s+([a-f0-9]{8,})$/i.exec(text.trim());
    if (chatId && match) {
      const token = match[1];
      const user = await prisma.user.findUnique({ where: { telegramLinkToken: token } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramChatId: String(chatId), telegramLinkToken: null },
        });
        sendTelegram(String(chatId), 'Ohnyk: сповіщення підключено ✅').catch(() => {});
      }
    }
    res.json({ ok: true }); // always ack so Telegram stops retrying
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/device — register this device for push.
//
// Upserted by token, not by user: when a different account signs in on the same
// device the row must MOVE to the new user rather than duplicate, or the
// previous owner keeps receiving someone else's notifications.
export async function registerDevice(req, res, next) {
  try {
    const { token, platform } = deviceTokenSchema.parse(req.body);
    await prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform, userId: req.user.id },
      update: { platform, userId: req.user.id, lastSeenAt: new Date() },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications/device — drop this device on logout, so whoever
// uses the handset next does not receive the previous account's notifications.
// Scoped to the caller: a token belonging to someone else is left untouched.
export async function unregisterDevice(req, res, next) {
  try {
    const { token } = deviceUnregisterSchema.parse(req.body);
    await prisma.deviceToken.deleteMany({ where: { token, userId: req.user.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
