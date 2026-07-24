// Startup environment validation.
//
// In production a misconfigured secret is a silent, critical vulnerability:
// the JWT libs fall back to well-known dev defaults, so anyone can forge a
// token. This module fails fast — the process refuses to start rather than
// come up insecure. Outside production it only warns, so local dev and the
// test suite keep working with the committed .env.example defaults.

// The dev fallbacks baked into lib/jwt.js. Using either of these in production
// means every attacker who has read the source can mint valid tokens.
const INSECURE_JWT_DEFAULTS = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
]);

const MIN_SECRET_LENGTH = 16;

function isProd() {
  return process.env.NODE_ENV === 'production';
}

const DEV_CORS_DEFAULT = 'http://localhost:5173';

// Parsed, cleaned allow-list of frontend origins for CORS. Falls back to the
// dev origin outside production; in production the value must be set explicitly
// (enforced by collectConfigProblems).
export function corsOrigins() {
  return (process.env.CORS_ORIGIN || DEV_CORS_DEFAULT)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Non-secret configuration that is unsafe in production if wrong.
export function collectConfigProblems() {
  const problems = [];

  if (isProd()) {
    if (!process.env.CORS_ORIGIN || !process.env.CORS_ORIGIN.trim()) {
      problems.push('CORS_ORIGIN must be set in production (no localhost fallback)');
    }
    const origins = corsOrigins();
    if (origins.includes('*')) {
      problems.push("CORS_ORIGIN must not be '*' with credentialed requests");
    }
    for (const o of origins) {
      if (o !== '*' && !/^https?:\/\/.+/i.test(o)) {
        problems.push(`CORS_ORIGIN entry is not a valid origin: ${o}`);
      }
    }
  }

  return problems;
}

// Returns a list of human-readable problems with the current secret config.
export function collectSecretProblems() {
  const problems = [];

  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[name];
    if (!value) {
      problems.push(`${name} is not set`);
    } else if (INSECURE_JWT_DEFAULTS.has(value)) {
      problems.push(`${name} still uses the insecure dev default`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`);
    }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }

  return problems;
}

// Call once at process startup (server.js). Throws in production if any secret
// or config value is missing/insecure; otherwise logs a warning and continues.
export function assertSecureEnv() {
  const problems = [...collectSecretProblems(), ...collectConfigProblems()];
  if (problems.length === 0) return;

  const header = 'Insecure configuration:';
  const detail = problems.map((p) => `  • ${p}`).join('\n');

  if (isProd()) {
    throw new Error(`${header}\n${detail}\nRefusing to start in production. Set strong, unique secrets.`);
  }

  // Dev/test: warn but keep running so the committed defaults still work.
  console.warn(`⚠️  ${header}\n${detail}`);

  // MONO_TOKEN is optional (empty → stub gateway). Only nudge in production,
  // handled below so the warning is skipped entirely in dev.
  if (isProd() && !process.env.MONO_TOKEN) {
    console.warn('⚠️  MONO_TOKEN is empty in production — payments run in stub mode.');
  }
}
