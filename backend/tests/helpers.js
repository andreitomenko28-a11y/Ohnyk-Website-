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
