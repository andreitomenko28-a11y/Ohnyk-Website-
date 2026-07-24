import { describe, it, expect } from 'vitest';
import { request, registerCook, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { MAX_ATTEMPTS } from '../src/lib/sms.js';

// Module 2 (security) — phone-verification brute-force protection.
describe('Phone verification hardening', () => {
  async function requestCode(token) {
    const res = await request.post('/api/cook/verification/phone/request').set(authHeader(token));
    return res;
  }
  const confirm = (token, code) =>
    request.post('/api/cook/verification/phone/confirm').set(authHeader(token)).send({ code });

  it('locks the challenge after too many wrong attempts, even for the right code', async () => {
    const { accessToken, user } = await registerCook();
    await requestCode(accessToken);

    // Exhaust the attempt budget with wrong guesses.
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      const r = await confirm(accessToken, '9999');
      expect(r.status).toBe(400); // still just "wrong code"
    }
    const locked = await confirm(accessToken, '9999');
    expect(locked.status).toBe(429); // budget exhausted

    // The correct code is now refused until a new code is requested.
    const afterLock = await confirm(accessToken, '0000');
    expect(afterLock.status).toBe(429);

    // The cook must not have been verified.
    const cook = await prisma.cook.findUnique({ where: { userId: user.id } });
    expect(cook.phoneVerified).toBe(false);
  });

  it('a fresh request resets the attempt counter and lets the user verify', async () => {
    const { accessToken } = await registerCook();
    await requestCode(accessToken);
    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirm(accessToken, '9999');
    expect((await confirm(accessToken, '0000')).status).toBe(429); // locked

    // Requesting a new code clears attempts and consumed/expiry state.
    await requestCode(accessToken);
    const ok = await confirm(accessToken, '0000');
    expect(ok.status).toBe(200);
    expect(ok.body.cook.phoneVerified).toBe(true);
  });

  it('rejects an expired code', async () => {
    const { accessToken, user } = await registerCook();
    await requestCode(accessToken);
    // Force the challenge into the past.
    await prisma.phoneVerification.update({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await confirm(accessToken, '0000');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/недійсний|застарілий/i);
  });

  it('consumes the code so it cannot be replayed', async () => {
    const { accessToken } = await registerCook();
    await requestCode(accessToken);
    expect((await confirm(accessToken, '0000')).status).toBe(200);
    // Second use of the same (now consumed) code fails.
    const replay = await confirm(accessToken, '0000');
    expect(replay.status).toBe(400);
  });

  it('never stores the verification code in plaintext', async () => {
    const { accessToken, user } = await registerCook();
    await requestCode(accessToken);
    const row = await prisma.phoneVerification.findUnique({ where: { userId: user.id } });
    expect(row.codeHash).toBeTruthy();
    expect(row.codeHash).not.toBe('0000');
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
  });
});
