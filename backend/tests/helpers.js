import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const request = supertest(createApp());

// Registers a user and returns { user, accessToken, refreshToken }.
export async function registerUser(overrides = {}) {
  const payload = {
    fullName: 'Тест Користувач',
    email: `user${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: 'password123',
    role: 'CUSTOMER',
    ...overrides,
  };
  const res = await request.post('/api/auth/register').send(payload);
  return { ...res.body, password: payload.password };
}

// Convenience for authenticated requests in tests.
export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// Registers a cook through the real onboarding endpoint (phone + kitchen
// address required). Returns { user, accessToken, refreshToken, cook }.
export async function registerCook(overrides = {}) {
  const payload = {
    fullName: 'Кухар Тест',
    email: `cook${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
    phone: `+38063${Math.floor(1000000 + Math.random() * 8999999)}`,
    password: 'password123',
    role: 'COOK',
    kitchenAddress: 'вул. Тестова, 1, Черкаси',
    deliveryZone: 'Центр',
    bio: 'Смачно готую',
    ...overrides,
  };
  const res = await request.post('/api/auth/register').send(payload);
  // Surface the cook profile at the top level for convenience.
  return { ...res.body, cook: res.body.user?.cook };
}

// Registers a cook and marks them VERIFIED + ACTIVE (skips the admin step).
// Returns { user, accessToken, refreshToken, cook }.
export async function registerActiveCook(overrides = {}) {
  const body = await registerCook(overrides);
  await prisma.cook.update({
    where: { id: body.cook.id },
    data: { verificationStatus: 'VERIFIED', status: 'ACTIVE', isVerified: true, phoneVerified: true },
  });
  return body;
}

// Marks an order as paid: status → NEW with a successful Payment attached.
// Mirrors what the payment-success flow (Module 4.2) will do.
export async function payOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'NEW',
      payment: { create: { status: 'SUCCESS', amount: order.total, provider: 'monopay' } },
      events: { create: { status: 'NEW' } },
    },
  });
}

// Creates an ADMIN and returns a token whose payload carries the ADMIN role
// (role is promoted in the DB, then a fresh login re-issues the token).
export async function createAdmin() {
  const email = `admin${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
  const reg = await registerUser({ email, role: 'CUSTOMER' });
  await prisma.user.update({ where: { id: reg.user.id }, data: { role: 'ADMIN' } });
  const login = await request
    .post('/api/auth/login')
    .send({ identifier: email, password: reg.password });
  return login.body; // { user, accessToken, refreshToken }
}

// Creates a category (idempotent by slug).
export async function createCategory({ name = 'Борщ', slug = 'borshch', emoji = '🥣' } = {}) {
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name, slug, emoji },
  });
}

// Registers a COOK, enriches the cook profile, and attaches dishes.
// Returns { user, accessToken, cook, dishes }.
export async function createCookWithDishes({
  fullName = 'Кухар Тест',
  bio = 'Смачно готую',
  rating = 4.5,
  city = 'Черкаси',
  dishes = [{ name: 'Борщ', price: 90 }],
  categorySlug = null,
} = {}) {
  const auth = await registerUser({ fullName, role: 'COOK' });
  const cook = await prisma.cook.update({
    where: { userId: auth.user.id },
    data: { bio, rating, city, isVerified: true },
  });

  let categoryId = null;
  if (categorySlug) {
    const cat = await createCategory({ slug: categorySlug, name: categorySlug, emoji: '🍽️' });
    categoryId = cat.id;
  }

  const created = [];
  for (const d of dishes) {
    created.push(
      await prisma.dish.create({
        data: {
          cookId: cook.id,
          name: d.name,
          description: d.description ?? null,
          price: d.price,
          categoryId: d.categoryId ?? categoryId,
          isAvailable: d.isAvailable ?? true,
        },
      })
    );
  }

  return { ...auth, cook, dishes: created };
}
