// Transactional email — STUB-first (mirrors lib/sms.js / lib/telegram.js).
//
// Without BREVO_API_KEY we log instead of sending, so admin flows are testable
// with no provider. Wire Brevo (or any provider) here later — a drop-in change.
import { logger } from './logger.js';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Ohnyk <no-reply@ohnyk.app>';

export function emailEnabled() {
  return !!BREVO_API_KEY;
}

export async function sendEmail({ to, subject, text }) {
  if (!emailEnabled()) {
    // Body may contain reset links/tokens — the logger redacts secret-shaped
    // strings before anything reaches stdout.
    logger.info('email:stub', { to, subject, text: text?.replace(/\n/g, ' ') });
    return { delivered: false, channel: 'stub' };
  }
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: parseSender(FROM),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
  return { delivered: true, channel: 'brevo' };
}

function parseSender(from) {
  const m = /^(.*)<(.+)>$/.exec(from);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { email: from };
}
