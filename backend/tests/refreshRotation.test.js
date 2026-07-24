import { describe, it, expect } from 'vitest';
import { request, registerUser } from './helpers.js';

// Module 5c (P1 security) — rotating refresh tokens with reuse detection.
const refresh = (token) => request.post('/api/auth/refresh').send({ refreshToken: token });

describe('Refresh-token rotation', () => {
  it('rotates the token on every refresh (issues a new one)', async () => {
    const { refreshToken } = await registerUser();
    const r1 = await refresh(refreshToken);
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).toBeTruthy();
    expect(r1.body.refreshToken).not.toBe(refreshToken);
    expect(r1.body.accessToken).toBeTruthy();

    // The freshly rotated token works too.
    const r2 = await refresh(r1.body.refreshToken);
    expect(r2.status).toBe(200);
  });

  it('rejects reuse of an already-rotated token and revokes the family', async () => {
    const { refreshToken } = await registerUser();
    const rotated = await refresh(refreshToken);
    expect(rotated.status).toBe(200);

    // Reusing the original (now consumed) token is refused…
    const reuse = await refresh(refreshToken);
    expect(reuse.status).toBe(401);

    // …and the reuse trips family revocation, so the token that was valid a
    // moment ago is now dead too.
    const afterBreach = await refresh(rotated.body.refreshToken);
    expect(afterBreach.status).toBe(401);
  });

  it('rejects an unknown / already-invalid refresh token', async () => {
    const { refreshToken } = await registerUser();
    // A structurally valid JWT that was never stored (logout-then-reuse shape).
    await request.post('/api/auth/logout').send({ refreshToken });
    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
  });

  it('logout revokes the session so the token can no longer refresh', async () => {
    const { refreshToken } = await registerUser();
    const out = await request.post('/api/auth/logout').send({ refreshToken });
    expect(out.status).toBe(200);
    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
  });

  it('never stores the refresh token in plaintext', async () => {
    const { user, refreshToken } = await registerUser();
    const { prisma } = await import('../src/lib/prisma.js');
    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows.length).toBe(1);
    expect(rows[0].tokenHash).not.toBe(refreshToken);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
