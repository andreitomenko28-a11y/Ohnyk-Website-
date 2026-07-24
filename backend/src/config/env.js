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
// is missing/insecure; otherwise logs a warning and continues.
export function assertSecureEnv() {
  const problems = collectSecretProblems();
  if (problems.length === 0) return;

  const header = 'Insecure secret configuration:';
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
