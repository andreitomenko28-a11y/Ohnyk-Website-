import { describe, it, expect } from 'vitest';
import {
  request,
  registerUser,
  registerActiveCook,
  createAdmin,
  createCookWithDishes,
  authHeader,
} from './helpers.js';

// Module 3 (security) — authorization audit regression tests. Locks the
// conclusion that owner/role scoping holds on the sensitive surface.
describe('Authorization', () => {
  describe('GET /api/users/:id — owner/admin only (exposes email/phone)', () => {
    it('rejects unauthenticated access', async () => {
      const owner = await registerUser();
      const res = await request.get(`/api/users/${owner.user.id}`);
      expect(res.status).toBe(401);
    });

    it('returns 404 (not 403) to a different user, so ids cannot be enumerated', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const res = await request.get(`/api/users/${owner.user.id}`).set(authHeader(stranger.accessToken));
      expect(res.status).toBe(404);
    });

    it('lets the owner and an admin read the profile', async () => {
      const owner = await registerUser();
      const mine = await request.get(`/api/users/${owner.user.id}`).set(authHeader(owner.accessToken));
      expect(mine.status).toBe(200);
      expect(mine.body.user.email).toBe(owner.user.email);

      const admin = await createAdmin();
      const byAdmin = await request.get(`/api/users/${owner.user.id}`).set(authHeader(admin.accessToken));
      expect(byAdmin.status).toBe(200);
    });
  });

  describe('role guards', () => {
    it('forbids a non-admin from the admin area (403)', async () => {
      const customer = await registerUser();
      const res = await request.get('/api/admin/users').set(authHeader(customer.accessToken));
      expect(res.status).toBe(403);
    });

    it('forbids a customer from the cook area (403)', async () => {
      const customer = await registerUser();
      const res = await request.get('/api/cook/me').set(authHeader(customer.accessToken));
      expect(res.status).toBe(403);
    });

    it('forbids a customer from the courier area (403)', async () => {
      const customer = await registerUser();
      const res = await request.get('/api/courier/me').set(authHeader(customer.accessToken));
      expect(res.status).toBe(403);
    });
  });

  describe('cross-owner isolation', () => {
    it("a cook cannot edit another cook's dish (404)", async () => {
      const victim = await createCookWithDishes({ dishes: [{ name: 'Борщ', price: 90 }] });
      const attacker = await registerActiveCook();
      const res = await request
        .put(`/api/cook/dishes/${victim.dishes[0].id}`)
        .set(authHeader(attacker.accessToken))
        .send({ name: 'Hijacked', price: 1 });
      expect(res.status).toBe(404);
    });
  });
});
