import supertest from 'supertest';
import { createApp } from '../src/app.js';

export const request = supertest(createApp());

// Registers a user and returns { user, accessToken, refreshToken }.
export async function registerUser(overrides = {}) {
  const payload = {
    fullName: 'Тест Користувач',
    email: `user${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: 'password123',
    role: 'CUSTOMER',
    ...overrides,
  };
  const res = await request.post('/api/auth/register').send(payload);
  return { ...res.body, password: payload.password };
}
