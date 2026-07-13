import { beforeEach, afterAll } from 'vitest';
import { resolveTestDatabaseUrl } from './globalSetup.js';

// Ensure the Prisma client in tests targets the same test DB as globalSetup.
process.env.DATABASE_URL = resolveTestDatabaseUrl();

const { prisma } = await import('../src/lib/prisma.js');

// Start every test from a clean slate. Order respects FK constraints;
// cascades then handle the rest when users/cooks are removed.
beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dishPhoto.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.category.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.address.deleteMany();
  await prisma.cook.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
