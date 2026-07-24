// Rate limiting.
//
// Protects the app from brute-force (login/refresh/password-reset), spam
// (order creation, uploads) and generic API flooding. Built on
// express-rate-limit with in-memory buckets — fine for a single-node MVP.
// For a multi-instance deployment, swap in a shared store (e.g.
// rate-limit-redis) via the `store` option without touching call sites.
//
// Limits are env-overridable so they can be tuned per environment without a
// code change. Under NODE_ENV=test the limiters become pass-through no-ops so
// the integration suite (which fires hundreds of logins) isn't throttled; the
// factory itself is still covered by a dedicated unit test.

import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// A middleware that does nothing — used to disable limiting in the test env.
const passthrough = (_req, _res, next) => next();

function num(name, fallback) {
  const raw = process.env[name];
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Standard JSON 429 response, consistent with the app's error shape.
function tooMany(_req, res) {
  res.status(429).json({ error: 'Забагато запитів. Спробуйте пізніше.' });
}

// Build a limiter with sane shared defaults. Exported so tests can construct
// an isolated instance with a tiny `max`.
export function makeRateLimiter({ windowMs, max, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: false,
    handler: tooMany,
  });
}

// Wraps a limiter so it's a no-op in the test environment.
function guard(limiter) {
  return isTest ? passthrough : limiter;
}

const MIN = 60 * 1000;

// Auth-sensitive endpoints (login, refresh, password-reset). Only failed
// attempts count, so a legitimate user logging in repeatedly isn't punished
// while a password-guessing attacker is.
export const authLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_AUTH_WINDOW_MS', 15 * MIN),
    max: num('RATE_AUTH_MAX', 10),
    skipSuccessfulRequests: true,
  }),
);

// Registration — cheaper to abuse for mass account creation than login.
export const registerLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_REGISTER_WINDOW_MS', 60 * MIN),
    max: num('RATE_REGISTER_MAX', 10),
  }),
);

// Order creation (checkout).
export const orderLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_ORDER_WINDOW_MS', 60 * MIN),
    max: num('RATE_ORDER_MAX', 30),
  }),
);

// File/image uploads (avatars, dish photos, verification docs, review photos).
export const uploadLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_UPLOAD_WINDOW_MS', 15 * MIN),
    max: num('RATE_UPLOAD_MAX', 40),
  }),
);

// Phone-verification request/confirm. Caps how often codes are sent (SMS cost)
// and closes the loop where an attacker re-requests a code to reset the
// per-challenge attempt counter and keep guessing.
export const verifyLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_VERIFY_WINDOW_MS', 15 * MIN),
    max: num('RATE_VERIFY_MAX', 15),
  }),
);

// Generic ceiling for the whole API, catching anything not covered above.
export const globalLimiter = guard(
  makeRateLimiter({
    windowMs: num('RATE_GLOBAL_WINDOW_MS', 1 * MIN),
    max: num('RATE_GLOBAL_MAX', 200),
  }),
);
