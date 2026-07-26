// Expo Push notifications — STUB-first, mirroring lib/telegram.js and
// lib/email.js.
//
// Expo's push service needs no API key, so there is no provider secret to gate
// on the way MONO_TOKEN or TELEGRAM_BOT_TOKEN do. EXPO_PUSH_ENABLED is an
// explicit opt-in instead, which keeps dev runs and the test suite off the
// network rather than firing real notifications at whoever last registered a
// device.

import { prisma } from './prisma.js';
import { logger } from './logger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo rejects batches larger than this.
const MAX_BATCH = 100;

export function pushEnabled() {
  return process.env.EXPO_PUSH_ENABLED === 'true';
}

// Expo answers per-message. A ticket with DeviceNotRegistered means the app was
// uninstalled or the token was invalidated — that token is dead permanently, so
// it is pruned. Without this the table fills with tokens that cost a request on
// every future send and never deliver anything.
export function collectDeadTokens(response, tokens) {
  const tickets = Array.isArray(response?.data) ? response.data : [];
  const dead = [];
  tickets.forEach((ticket, i) => {
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      const token = ticket.details?.expoPushToken ?? tokens[i];
      if (token) dead.push(token);
    }
  });
  return dead;
}

// Fire-and-forget by contract: callers must not let a push failure break a
// notification that is already persisted and delivered in-app.
export async function sendPush(tokens, { title, body, data } = {}) {
  const targets = [...new Set((tokens ?? []).filter(Boolean))];
  if (targets.length === 0) return { delivered: false, channel: 'none' };

  if (!pushEnabled()) {
    logger.info('push:stub', { count: targets.length, title });
    return { delivered: false, channel: 'stub' };
  }

  const messages = targets
    .slice(0, MAX_BATCH)
    .map((to) => ({ to, title, body, data, sound: 'default' }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const json = await res.json().catch(() => null);
  const dead = collectDeadTokens(json, targets);
  if (dead.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    logger.info('push:pruned-dead-tokens', { count: dead.length });
  }

  return { delivered: res.ok, channel: 'expo', pruned: dead.length };
}
