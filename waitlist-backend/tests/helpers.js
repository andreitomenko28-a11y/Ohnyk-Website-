import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// Spins up an isolated SQLite database for a test file and returns the
// Express app + Prisma client. Call from a `before()` hook AFTER the test
// file has set any env it needs (ADMIN_TOKEN, RATE_LIMIT_MAX, …), because
// the app/prisma modules read env at import time.
export async function setupApp(dbName) {
  const dbPath = path.join(root, 'data', dbName);
  process.env.DATABASE_URL = 'file:' + dbPath;
  for (const f of [dbPath, dbPath + '-journal']) fs.rmSync(f, { force: true });

  // Build the schema on the fresh file.
  execSync('npx prisma migrate deploy', { cwd: root, stdio: 'ignore', env: process.env });

  const { createApp } = await import('../src/app.js');
  const { prisma } = await import('../src/lib/prisma.js');
  return { app: createApp(), prisma };
}
