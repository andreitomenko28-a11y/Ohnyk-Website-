import { beforeEach, afterAll } from 'vitest';
import { resolveTestDatabaseUrl } from './globalSetup.js';

// Ensure the Prisma client in tests targets the same test DB as globalSetup.
process.env.DATABASE_URL = resolveTestDatabaseUrl();

const { prisma } = await import('../src/lib/prisma.js');

// Start every test from a clean slate. Cascades handle Cook/Address rows.
beforeEach(async () => {
  await prisma.address.deleteMany();
  await prisma.cook.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
