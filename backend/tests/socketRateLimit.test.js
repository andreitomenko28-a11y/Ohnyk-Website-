import { describe, it, expect } from 'vitest';
import { createEventLimiter } from '../src/realtime/rateLimit.js';

// Module P2 — per-socket event rate limiting (pure sliding-window core).
describe('socket event rate limiter', () => {
  it('allows up to the per-event budget, then drops', () => {
    const { allow } = createEventLimiter({
      global: { windowMs: 1000, max: 100 },
      perEvent: { 'location:update': { windowMs: 1000, max: 3 } },
    });
    const t = 10_000;
    expect(allow('location:update', t)).toBe(true);
    expect(allow('location:update', t)).toBe(true);
    expect(allow('location:update', t)).toBe(true);
    expect(allow('location:update', t)).toBe(false); // 4th within window
  });

  it('refills as timestamps age out of the window', () => {
    const { allow } = createEventLimiter({
      perEvent: { 'location:update': { windowMs: 1000, max: 2 } },
    });
    expect(allow('location:update', 0)).toBe(true);
    expect(allow('location:update', 500)).toBe(true);
    expect(allow('location:update', 900)).toBe(false); // window full
    // At t=1600 the first (t=0) timestamp has aged out → one slot free again.
    expect(allow('location:update', 1600)).toBe(true);
  });

  it('tracks each event independently and falls back to the global budget', () => {
    const { allow } = createEventLimiter({
      global: { windowMs: 1000, max: 1 },
      perEvent: { 'chat:join': { windowMs: 1000, max: 1 } },
    });
    const t = 1;
    // Distinct events don't share a bucket.
    expect(allow('chat:join', t)).toBe(true);
    expect(allow('some:other', t)).toBe(true); // uses global
    // Each is now at its own limit.
    expect(allow('chat:join', t)).toBe(false);
    expect(allow('some:other', t)).toBe(false);
  });
});
