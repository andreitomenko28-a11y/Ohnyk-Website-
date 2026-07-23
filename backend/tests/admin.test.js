import { describe, it, expect } from 'vitest';
import { request, registerUser, registerCook, createAdmin, authHeader } from './helpers.js';

describe('Admin cook verification (Module 3.1)', () => {
  it('forbids non-admins from the admin API', async () => {
    const cook = await registerCook();
    const customer = await registerUser({ role: 'CUSTOMER' });

    const asCook = await request
      .get('/api/admin/cooks/pending')
      .set(authHeader(cook.accessToken));
    expect(asCook.status).toBe(403);

    const asCustomer = await request
      .get('/api/admin/cooks/pending')
      .set(authHeader(customer.accessToken));
    expect(asCustomer.status).toBe(403);
  });

  it('lists pending cooks and verifies one', async () => {
    const admin = await createAdmin();
    const { cook } = await registerCook({ displayName: 'Очікує Перевірки' });

    const pending = await request
      .get('/api/admin/cooks/pending')
      .set(authHeader(admin.accessToken));
    expect(pending.status).toBe(200);
    expect(pending.body.cooks.some((c) => c.id === cook.id)).toBe(true);

    const verify = await request
      .post(`/api/admin/cooks/${cook.id}/verify`)
      .set(authHeader(admin.accessToken));
    expect(verify.status).toBe(200);
    expect(verify.body.cook.verificationStatus).toBe('VERIFIED');
    expect(verify.body.cook.status).toBe('ACTIVE');

    // Now out of the pending queue.
    const after = await request
      .get('/api/admin/cooks/pending')
      .set(authHeader(admin.accessToken));
    expect(after.body.cooks.some((c) => c.id === cook.id)).toBe(false);
  });

  it('returns 409 when verifying an already-verified cook', async () => {
    const admin = await createAdmin();
    const { cook } = await registerCook();
    await request.post(`/api/admin/cooks/${cook.id}/verify`).set(authHeader(admin.accessToken));
    const again = await request
      .post(`/api/admin/cooks/${cook.id}/verify`)
      .set(authHeader(admin.accessToken));
    expect(again.status).toBe(409);
  });

  it('returns 404 verifying an unknown cook', async () => {
    const admin = await createAdmin();
    const res = await request
      .post('/api/admin/cooks/does-not-exist/verify')
      .set(authHeader(admin.accessToken));
    expect(res.status).toBe(404);
  });

  it('rejects a cook verification', async () => {
    const admin = await createAdmin();
    const { cook } = await registerCook();
    const res = await request
      .post(`/api/admin/cooks/${cook.id}/reject`)
      .set(authHeader(admin.accessToken))
      .send({ reason: 'Нечіткий документ' });
    expect(res.status).toBe(200);
    expect(res.body.cook.verificationStatus).toBe('REJECTED');
    expect(res.body.cook.isVerified).toBe(false);
  });
});

describe('Admin moderation (Module 7.1)', () => {
  it('lists users with role filter and search', async () => {
    const admin = await createAdmin();
    const u = await registerUser({ role: 'CUSTOMER', fullName: 'Шукайло Тест' });

    const all = await request.get('/api/admin/users').set(authHeader(admin.accessToken));
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThan(0);

    const cooksOnly = await request.get('/api/admin/users?role=COOK').set(authHeader(admin.accessToken));
    expect(cooksOnly.body.users.every((x) => x.role === 'COOK')).toBe(true);

    const byEmail = await request.get(`/api/admin/users?q=${encodeURIComponent(u.user.email)}`).set(authHeader(admin.accessToken));
    expect(byEmail.body.users.some((x) => x.id === u.user.id)).toBe(true);
  });

  it('lists cooks filtered by verification status', async () => {
    const admin = await createAdmin();
    await registerCook(); // a PENDING cook
    const pending = await request.get('/api/admin/cooks?status=PENDING').set(authHeader(admin.accessToken));
    expect(pending.status).toBe(200);
    expect(pending.body.cooks.every((c) => c.verificationStatus === 'PENDING')).toBe(true);
  });

  it('blocks a user (login + existing token rejected) and unblocks', async () => {
    const admin = await createAdmin();
    const victim = await registerUser({ role: 'CUSTOMER' });

    const blocked = await request
      .patch(`/api/admin/users/${victim.user.id}/block`)
      .set(authHeader(admin.accessToken))
      .send({ reason: 'спам' });
    expect(blocked.status).toBe(200);
    expect(blocked.body.user.isBlocked).toBe(true);

    // existing access token is rejected immediately
    expect((await request.get('/api/orders').set(authHeader(victim.accessToken))).status).toBe(403);
    // login is refused
    const relogin = await request.post('/api/auth/login').send({ identifier: victim.user.email, password: victim.password });
    expect(relogin.status).toBe(403);

    // unblock restores access
    const unblocked = await request.patch(`/api/admin/users/${victim.user.id}/unblock`).set(authHeader(admin.accessToken));
    expect(unblocked.body.user.isBlocked).toBe(false);
    expect((await request.get('/api/orders').set(authHeader(victim.accessToken))).status).toBe(200);
  });

  it('cannot block an admin or oneself', async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    expect((await request.patch(`/api/admin/users/${other.user.id}/block`).set(authHeader(admin.accessToken))).status).toBe(403);
    expect((await request.patch(`/api/admin/users/${admin.user.id}/block`).set(authHeader(admin.accessToken))).status).toBe(400);
  });

  it('records an audit log entry on block', async () => {
    const admin = await createAdmin();
    const victim = await registerUser({ role: 'CUSTOMER' });
    await request.patch(`/api/admin/users/${victim.user.id}/block`).set(authHeader(admin.accessToken)).send({ reason: 'r' });

    const { prisma } = await import('../src/lib/prisma.js');
    const log = await prisma.adminLog.findFirst({ where: { action: 'user.block', targetId: victim.user.id } });
    expect(log).toBeTruthy();
    expect(log.adminId).toBe(admin.user.id);
  });
});
