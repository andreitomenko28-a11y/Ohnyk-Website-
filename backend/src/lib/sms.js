// Phone verification.
//
// The SMS provider is still a STUB (no real delivery), but the code lifecycle
// is owned locally and hardened against brute force:
//   • the code is stored only as an HMAC hash, never plaintext;
//   • it expires after a short TTL;
//   • a capped number of wrong guesses locks the challenge (must re-request);
//   • a successful check consumes it, so it can't be replayed.
//
// TODO(Phase 4+): swap `deliverSms` for a real provider (Twilio Verify /
// Vonage / Kyivstar). If the provider owns the code lifecycle server-side,
// this table can be dropped; if it only delivers text, keep it as-is and feed
// a random code into `deliverSms`.

import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

// Fixed code in the stub so dev/tests have a deterministic value. A real
// provider would use `randomCode()` instead.
export const STUB_CODE = '0000';

export const CODE_TTL_MS = Number(process.env.PHONE_CODE_TTL_MS) || 10 * 60 * 1000; // 10 min
export const MAX_ATTEMPTS = Number(process.env.PHONE_CODE_MAX_ATTEMPTS) || 5;

const isProd = () => process.env.NODE_ENV === 'production';

// HMAC the code with the server secret so a database leak doesn't expose codes
// directly (and can't be reversed via a trivial rainbow table). The tiny code
// space still relies on MAX_ATTEMPTS + TTL for real brute-force resistance.
function hashCode(code) {
  const key = process.env.JWT_SECRET || 'dev-access-secret-change-me';
  return crypto.createHmac('sha256', key).update(String(code)).digest('hex');
}

// A random 6-digit code, used in production. The stub uses STUB_CODE instead.
function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Stub SMS "delivery": logs instead of sending. Never logs in production.
async function deliverSms(phone, code) {
  // Dev/test only — never log the code in production.
  if (!isProd()) logger.info('sms:stub', { phone, code });
}

// Issue a fresh verification code for a user: generates, hashes, stores (one
// row per user, replacing any previous challenge), and "sends" it. Returns the
// dev code outside production so the UI/tests can use it; never in production.
export async function sendVerificationCode(userId, phone) {
  const code = isProd() ? randomCode() : STUB_CODE;
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.phoneVerification.upsert({
    where: { userId },
    create: { userId, phone, codeHash: hashCode(code), expiresAt, attempts: 0, lastSentAt: new Date() },
    update: { phone, codeHash: hashCode(code), expiresAt, attempts: 0, consumedAt: null, lastSentAt: new Date() },
  });

  await deliverSms(phone, code);

  return { sent: true, ...(isProd() ? {} : { devCode: code }) };
}

// Validate a submitted code. Returns { ok, reason } where reason is one of:
//   'ok' | 'no_code' | 'expired' | 'consumed' | 'locked' | 'mismatch'.
// A wrong guess increments the attempt counter; the correct code consumes the
// challenge. Uses a constant-time comparison for the hash.
export async function checkVerificationCode(userId, code) {
  const challenge = await prisma.phoneVerification.findUnique({ where: { userId } });
  if (!challenge) return { ok: false, reason: 'no_code' };
  if (challenge.consumedAt) return { ok: false, reason: 'consumed' };
  if (challenge.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashCode(code), 'hex');
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    const updated = await prisma.phoneVerification.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
    });
    const remaining = Math.max(0, MAX_ATTEMPTS - updated.attempts);
    return { ok: false, reason: remaining === 0 ? 'locked' : 'mismatch', remaining };
  }

  await prisma.phoneVerification.update({ where: { userId }, data: { consumedAt: new Date() } });
  return { ok: true, reason: 'ok' };
}
