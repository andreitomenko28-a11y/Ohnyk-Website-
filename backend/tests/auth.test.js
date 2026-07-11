import { describe, it, expect } from 'vitest';
import { request, registerUser } from './helpers.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/register', () => {
  it('registers a customer and returns tokens', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName: 'Андрій',
      email: 'andrii@example.com',
      password: 'password123',
      role: 'CUSTOMER',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'andrii@example.com', role: 'CUSTOMER' });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // Never leak the password hash.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('registers a cook and creates a cook profile', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName: 'Оксана',
      email: 'oksana@example.com',
      password: 'password123',
      role: 'COOK',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('COOK');
    expect(res.body.user.isVerified).toBe(false);
  });

  it('lowercases the email', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName: 'Тест',
      email: 'MixedCase@Example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('mixedcase@example.com');
  });

  it('rejects a short password (400)', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName: 'Тест',
      email: 'short@example.com',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/валідац/i);
  });

  it('rejects a duplicate email (409)', async () => {
    await registerUser({ email: 'dup@example.com' });
    const res = await request.post('/api/auth/register').send({
      fullName: 'Інший',
      email: 'dup@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('cannot self-register as ADMIN', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName: 'Хакер',
      email: 'admin-wannabe@example.com',
      password: 'password123',
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in by email', async () => {
    await registerUser({ email: 'login@example.com', password: 'password123' });
    const res = await request.post('/api/auth/login').send({
      identifier: 'login@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('logs in by phone', async () => {
    await registerUser({ email: 'phone@example.com', phone: '+380671112233' });
    const res = await request.post('/api/auth/login').send({
      identifier: '+380671112233',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('phone@example.com');
  });

  it('rejects a wrong password (401)', async () => {
    await registerUser({ email: 'wrong@example.com' });
    const res = await request.post('/api/auth/login').send({
      identifier: 'wrong@example.com',
      password: 'not-the-password',
    });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown user (401)', async () => {
    const res = await request.post('/api/auth/login').send({
      identifier: 'ghost@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid token', async () => {
    const { user, accessToken } = await registerUser({ email: 'me@example.com' });
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('rejects a request without a token (401)', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new tokens from a valid refresh token', async () => {
    const { refreshToken } = await registerUser({ email: 'refresh@example.com' });
    const res = await request.post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects a garbage refresh token (401)', async () => {
    const res = await request.post('/api/auth/refresh').send({ refreshToken: 'nope' });
    expect(res.status).toBe(401);
  });
});
