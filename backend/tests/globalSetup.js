import { execSync } from 'node:child_process';

// Runs once before the whole test suite: pushes the Prisma schema to an
// isolated test database so tests never touch dev/prod data.
//
// Point tests at a test DB with TEST_DATABASE_URL, e.g.:
//   postgresql://ohnyk:ohnyk@localhost:5432/ohnyk_test?schema=public
// Falls back to deriving an "<db>_test" name from DATABASE_URL.
export default function globalSetup() {
  const testUrl = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;

  console.log('[tests] using database:', redact(testUrl));
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

export function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const base =
    process.env.DATABASE_URL ||
    'postgresql://ohnyk:ohnyk@localhost:5432/ohnyk?schema=public';

  // Append _test to the database name to avoid clobbering the dev DB.
  const url = new URL(base);
  if (!url.pathname.endsWith('_test')) {
    url.pathname = `${url.pathname}_test`;
  }
  return url.toString();
}

function redact(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url;
  }
}
