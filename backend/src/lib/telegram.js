// Telegram notification channel — STUB-first (mirrors lib/sms.js).
//
// Without TELEGRAM_BOT_TOKEN we run in stub mode: linking still issues a token
// and messages are logged, so the whole flow is testable with no real bot. Set
// TELEGRAM_BOT_TOKEN (+ optionally TELEGRAM_BOT_USERNAME) to go live — sending
// then hits the Bot API, and the /start webhook links a user's chat id.
import { logger } from './logger.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'OhnykBot';

export function telegramEnabled() {
  return !!BOT_TOKEN;
}

export function botUsername() {
  return BOT_USERNAME;
}

// Deep link the user opens to connect their Telegram account.
export function linkUrl(token) {
  return `https://t.me/${BOT_USERNAME}?start=${token}`;
}

// Send a message to a linked chat. No-op log in stub mode.
export async function sendTelegram(chatId, text) {
  if (!telegramEnabled()) {
    logger.info('telegram:stub', { chatId, text: text.replace(/\n/g, ' | ') });
    return { delivered: false, channel: 'stub' };
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return { delivered: true, channel: 'telegram' };
}
