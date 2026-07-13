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
