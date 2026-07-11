import { describe, it, expect } from 'vitest';
import { request, registerUser } from './helpers.js';

describe('Users', () => {
  it('returns a public profile by id', async () => {
    const { user } = await registerUser({ email: 'profile@example.com' });
    const res = await request.get(`/api/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('profile@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request.get('/api/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('lets the owner update their own profile', async () => {
    const { user, accessToken } = await registerUser({ email: 'owner@example.com' });
    const res = await request
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Нове Ім’я' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Нове Ім’я');
  });

  it("forbids updating another user's profile (403)", async () => {
    const target = await registerUser({ email: 'target@example.com' });
    const { accessToken } = await registerUser({ email: 'attacker@example.com' });
    const res = await request
      .patch(`/api/users/${target.user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('updates a cook bio on the related profile', async () => {
    const { user, accessToken } = await registerUser({
      email: 'cookbio@example.com',
      role: 'COOK',
    });
    const res = await request
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'Готую борщ 20 років' });
    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('Готую борщ 20 років');
  });

  it('requires auth to update (401)', async () => {
    const { user } = await registerUser({ email: 'noauth@example.com' });
    const res = await request.patch(`/api/users/${user.id}`).send({ fullName: 'X' });
    expect(res.status).toBe(401);
  });
});
