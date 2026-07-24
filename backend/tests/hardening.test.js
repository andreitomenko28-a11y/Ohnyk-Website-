import { describe, it, expect, afterEach } from 'vitest';
import { request, registerUser, authHeader } from './helpers.js';
import { corsOrigins, collectConfigProblems } from '../src/config/env.js';

// Module 5 (P1 security) — CORS fail-fast + strict schemas.
describe('CORS config validation', () => {
  const snap = { NODE_ENV: process.env.NODE_ENV, CORS_ORIGIN: process.env.CORS_ORIGIN };
  afterEach(() => {
    process.env.NODE_ENV = snap.NODE_ENV;
    if (snap.CORS_ORIGIN === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = snap.CORS_ORIGIN;
  });

  it('parses and trims the allow-list', () => {
    process.env.CORS_ORIGIN = 'https://a.com, https://b.com ,';
    expect(corsOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });

  it('flags a missing or wildcard origin in production', () => {
    process.env.NODE_ENV = 'production';

    delete process.env.CORS_ORIGIN;
    expect(collectConfigProblems().some((p) => /CORS_ORIGIN must be set/.test(p))).toBe(true);

    process.env.CORS_ORIGIN = '*';
    expect(collectConfigProblems().some((p) => /must not be '\*'/.test(p))).toBe(true);

    process.env.CORS_ORIGIN = 'not-a-url';
    expect(collectConfigProblems().some((p) => /not a valid origin/.test(p))).toBe(true);
  });

  it('accepts a valid production origin', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://ohnyk.app';
    expect(collectConfigProblems()).toEqual([]);
  });

  it('never blocks outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGIN;
    expect(collectConfigProblems()).toEqual([]);
  });
});

describe('strict schemas reject unknown fields (mass-assignment defense)', () => {
  it('rejects an unexpected field on profile update', async () => {
    const { accessToken } = await registerUser();
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(accessToken))
      .send({ fullName: 'Legit Name', role: 'ADMIN', isBlocked: false });
    expect(res.status).toBe(400); // strict() rejects role/isBlocked outright
  });

  it('accepts a clean profile update', async () => {
    const { accessToken } = await registerUser();
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(accessToken))
      .send({ fullName: 'Legit Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Legit Name');
  });
});
