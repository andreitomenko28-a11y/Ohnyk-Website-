import { describe, it, expect } from 'vitest';
import { request, registerUser, authHeader } from './helpers.js';

describe('User profile', () => {
  it('returns the current user profile', async () => {
    const { accessToken, user } = await registerUser({ fullName: 'Ірина' });
    const res = await request.get('/api/users/profile').set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.fullName).toBe('Ірина');
  });

  it('requires auth for the profile', async () => {
    const res = await request.get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('updates name, phone and avatar', async () => {
    const { accessToken } = await registerUser();
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(accessToken))
      .send({ fullName: 'Нове Імя', phone: '+380991234567', avatar: 'data:image/png;base64,AAAA' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Нове Імя');
    expect(res.body.user.phone).toBe('+380991234567');
    expect(res.body.user.avatar).toBe('data:image/png;base64,AAAA');
  });

  it('lets a cook update bio and city via profile', async () => {
    const { accessToken } = await registerUser({ role: 'COOK' });
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(accessToken))
      .send({ bio: 'Домашній борщ', city: 'Львів' });
    expect(res.status).toBe(200);
    expect(res.body.user.cook.bio).toBe('Домашній борщ');
    expect(res.body.user.cook.city).toBe('Львів');
  });
});

describe('Addresses', () => {
  it('requires auth', async () => {
    const res = await request.get('/api/users/addresses');
    expect(res.status).toBe(401);
  });

  it('creates, lists and marks first address as default', async () => {
    const { accessToken } = await registerUser();
    const create = await request
      .post('/api/users/addresses')
      .set(authHeader(accessToken))
      .send({ city: 'Черкаси', street: 'Хрещатик', building: '1', apartment: '5' });
    expect(create.status).toBe(201);
    expect(create.body.address.isDefault).toBe(true);
    expect(create.body.address.apartment).toBe('5');

    const list = await request.get('/api/users/addresses').set(authHeader(accessToken));
    expect(list.body.addresses).toHaveLength(1);
  });

  it('moves the default flag to the newest default and via PUT', async () => {
    const { accessToken } = await registerUser();
    const a1 = await request
      .post('/api/users/addresses')
      .set(authHeader(accessToken))
      .send({ city: 'Черкаси', street: 'Перша', building: '1' });
    const a2 = await request
      .post('/api/users/addresses')
      .set(authHeader(accessToken))
      .send({ city: 'Черкаси', street: 'Друга', building: '2', isDefault: true });

    expect(a2.body.address.isDefault).toBe(true);

    // Flip default back to the first via the dedicated endpoint.
    const put = await request
      .put(`/api/users/addresses/${a1.body.address.id}/default`)
      .set(authHeader(accessToken));
    expect(put.status).toBe(200);
    expect(put.body.address.isDefault).toBe(true);

    const list = await request.get('/api/users/addresses').set(authHeader(accessToken));
    const defaults = list.body.addresses.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(a1.body.address.id);
  });

  it('updates and deletes an address, promoting a new default', async () => {
    const { accessToken } = await registerUser();
    const a1 = await request
      .post('/api/users/addresses')
      .set(authHeader(accessToken))
      .send({ city: 'Черкаси', street: 'Перша', building: '1' });
    const a2 = await request
      .post('/api/users/addresses')
      .set(authHeader(accessToken))
      .send({ city: 'Черкаси', street: 'Друга', building: '2' });

    const patch = await request
      .patch(`/api/users/addresses/${a2.body.address.id}`)
      .set(authHeader(accessToken))
      .send({ building: '99' });
    expect(patch.status).toBe(200);
    expect(patch.body.address.building).toBe('99');

    // Delete the default (a1) — a2 should become default.
    const del = await request
      .delete(`/api/users/addresses/${a1.body.address.id}`)
      .set(authHeader(accessToken));
    expect(del.status).toBe(204);

    const list = await request.get('/api/users/addresses').set(authHeader(accessToken));
    expect(list.body.addresses).toHaveLength(1);
    expect(list.body.addresses[0].isDefault).toBe(true);
  });

  it("cannot touch another user's address", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const a = await request
      .post('/api/users/addresses')
      .set(authHeader(owner.accessToken))
      .send({ city: 'Черкаси', street: 'Перша', building: '1' });

    const del = await request
      .delete(`/api/users/addresses/${a.body.address.id}`)
      .set(authHeader(other.accessToken));
    expect(del.status).toBe(404);
  });
});

describe('Password reset', () => {
  it('issues a token and resets the password', async () => {
    const { user, password } = await registerUser({ email: `reset${Date.now()}@example.com` });

    const req1 = await request.post('/api/auth/password-reset').send({ email: user.email });
    expect(req1.status).toBe(200);
    expect(req1.body.token).toBeTruthy();

    const confirm = await request
      .post('/api/auth/password-reset-confirm')
      .send({ token: req1.body.token, password: 'brandnew123' });
    expect(confirm.status).toBe(200);

    // Old password no longer works; new one does.
    const oldLogin = await request
      .post('/api/auth/login')
      .send({ identifier: user.email, password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request
      .post('/api/auth/login')
      .send({ identifier: user.email, password: 'brandnew123' });
    expect(newLogin.status).toBe(200);
  });

  it('does not reveal unknown emails and rejects bad tokens', async () => {
    const unknown = await request
      .post('/api/auth/password-reset')
      .send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.token).toBeUndefined();

    const bad = await request
      .post('/api/auth/password-reset-confirm')
      .send({ token: 'not-a-real-token', password: 'whatever123' });
    expect(bad.status).toBe(400);
  });
});
