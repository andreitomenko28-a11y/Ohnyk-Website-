import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { makeRateLimiter } from '../src/middleware/rateLimit.js';
import { collectSecretProblems } from '../src/config/env.js';

// The named limiters (authLimiter, uploadLimiter, …) are pass-through no-ops
// under NODE_ENV=test so the integration suite isn't throttled. Here we test
// the underlying factory directly on a throwaway app, so limiting is exercised
// for real regardless of the environment gate.
describe('rate limiting', () => {
  it('returns 429 once the request budget is exceeded', async () => {
    const app = express();
    app.use('/ping', makeRateLimiter({ windowMs: 60_000, max: 2 }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    const client = supertest(app);

    expect((await client.get('/ping')).status).toBe(200);
    expect((await client.get('/ping')).status).toBe(200);
    const third = await client.get('/ping');
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/Забагато запитів/);
  });

  it('skipSuccessfulRequests only counts failed responses', async () => {
    const app = express();
    // max 1, but successful (2xx) responses don't count — so only the first
    // failing (401) response consumes the single slot.
    app.use('/auth', makeRateLimiter({ windowMs: 60_000, max: 1, skipSuccessfulRequests: true }));
    app.post('/auth', (req, res) => {
      if (req.query.ok) return res.json({ ok: true });
      return res.status(401).json({ error: 'nope' });
    });
    const client = supertest(app);

    // Several successful calls never exhaust the budget.
    expect((await client.post('/auth?ok=1')).status).toBe(200);
    expect((await client.post('/auth?ok=1')).status).toBe(200);
    // First failure is allowed, second failure is blocked.
    expect((await client.post('/auth')).status).toBe(401);
    expect((await client.post('/auth')).status).toBe(429);
  });
});

describe('secret validation (config/env)', () => {
  const snapshot = { ...process.env };
  const restore = () => {
    process.env.JWT_SECRET = snapshot.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = snapshot.JWT_REFRESH_SECRET;
  };

  it('flags missing, default, short, and duplicate secrets', () => {
    process.env.JWT_SECRET = 'dev-access-secret-change-me'; // insecure default
    delete process.env.JWT_REFRESH_SECRET; // missing
    const problems = collectSecretProblems();
    expect(problems.some((p) => /JWT_SECRET.*dev default/.test(p))).toBe(true);
    expect(problems.some((p) => /JWT_REFRESH_SECRET is not set/.test(p))).toBe(true);
    restore();
  });

  it('accepts strong, unique secrets', () => {
    process.env.JWT_SECRET = 'a'.repeat(24);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(24);
    expect(collectSecretProblems()).toEqual([]);
    restore();
  });

  it('rejects identical access and refresh secrets', () => {
    process.env.JWT_SECRET = 'c'.repeat(24);
    process.env.JWT_REFRESH_SECRET = 'c'.repeat(24);
    expect(collectSecretProblems().some((p) => /must differ/.test(p))).toBe(true);
    restore();
  });
});
