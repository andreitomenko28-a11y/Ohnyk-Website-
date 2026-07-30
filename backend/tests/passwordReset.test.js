import { describe, it, expect } from 'vitest';
import { request, registerUser, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { revokeAllSessions } from '../src/lib/refreshTokens.js';

// A password reset is what someone does when they think another person is in
// their account. These cover the parts that made it only half-work.

async function userWithSecondDevice() {
  const user = await registerUser({ role: 'CUSTOMER' });
  // A second live session — stands in for the device the user is worried about.
  const other = await request
    .post('/api/auth/login')
    .send({ identifier: user.user.email, password: user.password });
  return { user, other: other.body };
}

async function requestReset(email) {
  const res = await request.post('/api/auth/password-reset').send({ email });
  return res.body.token;
}

async function adminToken() {
  const admin = await registerUser({ role: 'CUSTOMER' });
  await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  const login = await request
    .post('/api/auth/login')
    .send({ identifier: admin.user.email, password: admin.password });
  return login.body.accessToken;
}

describe('A password reset ends every other session', () => {
  it('revokes a session that was live before the reset', async () => {
    const { user, other } = await userWithSecondDevice();

    // Untouched until after the reset — reusing it earlier would trip the
    // reuse detector and hide what is being tested here.
    expect((await request.get('/api/auth/me').set(authHeader(other.accessToken))).status).toBe(200);

    const token = await requestReset(user.user.email);
    expect(
      (await request.post('/api/auth/password-reset-confirm').send({ token, password: 'brandNewPass456' })).status,
    ).toBe(200);

    const refreshed = await request.post('/api/auth/refresh').send({ refreshToken: other.refreshToken });
    expect(refreshed.status).toBe(401);
  });

  it('lets the owner log in with the new password and start a working session', async () => {
    const { user } = await userWithSecondDevice();
    const token = await requestReset(user.user.email);
    await request.post('/api/auth/password-reset-confirm').send({ token, password: 'brandNewPass456' });

    const login = await request
      .post('/api/auth/login')
      .send({ identifier: user.user.email, password: 'brandNewPass456' });
    expect(login.status).toBe(200);

    // The fresh session must not be caught by the revocation.
    const refreshed = await request.post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
  });

  it('rejects the old password afterwards', async () => {
    const { user } = await userWithSecondDevice();
    const token = await requestReset(user.user.email);
    await request.post('/api/auth/password-reset-confirm').send({ token, password: 'brandNewPass456' });

    const login = await request
      .post('/api/auth/login')
      .send({ identifier: user.user.email, password: user.password });
    expect(login.status).toBe(401);
  });

  it('revokeAllSessions leaves other accounts alone', async () => {
    const a = await registerUser({ role: 'CUSTOMER' });
    const b = await registerUser({ role: 'CUSTOMER' });

    await revokeAllSessions(a.user.id);

    expect((await request.post('/api/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);
    expect((await request.post('/api/auth/refresh').send({ refreshToken: b.refreshToken })).status).toBe(200);
  });
});

describe('Reset tokens are stored hashed', () => {
  it('never keeps the emailed token itself', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    const token = await requestReset(user.user.email);

    const row = await prisma.passwordReset.findFirst({ where: { userId: user.user.id } });
    expect(row).toBeTruthy();
    // A database dump must not hand over live reset links.
    expect(row.token).not.toBe(token);
    expect(row.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('still accepts the real token and refuses its stored hash', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    const token = await requestReset(user.user.email);
    const row = await prisma.passwordReset.findFirst({ where: { userId: user.user.id } });

    // Presenting the stored value must not work — that is the whole point.
    expect(
      (await request.post('/api/auth/password-reset-confirm').send({ token: row.token, password: 'nope12345' })).status,
    ).toBe(400);
    expect(
      (await request.post('/api/auth/password-reset-confirm').send({ token, password: 'realPass12345' })).status,
    ).toBe(200);
  });

  it('refuses an expired token', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    const token = await requestReset(user.user.email);
    await prisma.passwordReset.updateMany({
      where: { userId: user.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await request.post('/api/auth/password-reset-confirm').send({ token, password: 'tooLate12345' })).status,
    ).toBe(400);
  });

  it('spends the token once', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    const token = await requestReset(user.user.email);
    await request.post('/api/auth/password-reset-confirm').send({ token, password: 'firstPass1234' });
    expect(
      (await request.post('/api/auth/password-reset-confirm').send({ token, password: 'secondPass123' })).status,
    ).toBe(400);
  });
});

describe('A blocked account cannot reset its password', () => {
  it('issues no token, without revealing that the account is blocked', async () => {
    const admin = await adminToken();
    const user = await registerUser({ role: 'CUSTOMER' });
    await request.patch(`/api/admin/users/${user.user.id}/block`).set(authHeader(admin)).send({ reason: 'test' });

    const res = await request.post('/api/auth/password-reset').send({ email: user.user.email });
    // Same 200 and same wording an unknown address gets — no enumeration.
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(await prisma.passwordReset.count({ where: { userId: user.user.id } })).toBe(0);
  });

  it('refuses to spend a token issued before the block', async () => {
    const admin = await adminToken();
    const user = await registerUser({ role: 'CUSTOMER' });
    const token = await requestReset(user.user.email);

    await request.patch(`/api/admin/users/${user.user.id}/block`).set(authHeader(admin)).send({ reason: 'test' });

    const res = await request.post('/api/auth/password-reset-confirm').send({ token, password: 'blockedPass12' });
    expect(res.status).toBe(403);
  });
});
