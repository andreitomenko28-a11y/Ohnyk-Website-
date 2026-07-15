import { describe, it, expect } from 'vitest';
import { request, createCookWithDishes, createCategory } from './helpers.js';

describe('Discovery — cooks', () => {
  it('lists cooks with pagination metadata', async () => {
    await createCookWithDishes({ fullName: 'Кухар А', rating: 4.2 });
    await createCookWithDishes({ fullName: 'Кухар Б', rating: 4.9 });

    const res = await request.get('/api/cooks?limit=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.cooks).toHaveLength(1);
    // Highest rated first.
    expect(res.body.cooks[0].name).toBe('Кухар Б');
    expect(res.body.cooks[0]).toHaveProperty('priceFrom');
    expect(res.body.cooks[0]).toHaveProperty('dishCount');
  });

  it('returns a single cook by id and 404 otherwise', async () => {
    const { cook } = await createCookWithDishes({ fullName: 'Оксана' });
    const ok = await request.get(`/api/cooks/${cook.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.cook.name).toBe('Оксана');

    const missing = await request.get('/api/cooks/nonexistent-id');
    expect(missing.status).toBe(404);
  });

  it('searches by cook name and bio', async () => {
    await createCookWithDishes({ fullName: 'Оксана Ковальчук', bio: 'борщ і вареники' });
    await createCookWithDishes({ fullName: 'Дядько Гриць', bio: 'шашлики' });

    const byName = await request.get('/api/cooks/search?q=Гриць');
    expect(byName.body.total).toBe(1);
    expect(byName.body.cooks[0].name).toBe('Дядько Гриць');

    const byBio = await request.get('/api/cooks/search?q=борщ');
    expect(byBio.body.total).toBe(1);
    expect(byBio.body.cooks[0].name).toBe('Оксана Ковальчук');
  });

  it('filters by category, price and rating', async () => {
    await createCookWithDishes({
      fullName: 'Дешевий',
      rating: 4.0,
      categorySlug: 'borshch',
      dishes: [{ name: 'Борщ', price: 60 }],
    });
    await createCookWithDishes({
      fullName: 'Дорогий',
      rating: 4.95,
      categorySlug: 'desserts',
      dishes: [{ name: 'Торт', price: 400 }],
    });

    const byCategory = await request.get('/api/cooks/filter?category=desserts');
    expect(byCategory.body.cooks.map((c) => c.name)).toEqual(['Дорогий']);

    const byRating = await request.get('/api/cooks/filter?minRating=4.9');
    expect(byRating.body.cooks.map((c) => c.name)).toEqual(['Дорогий']);

    const byPrice = await request.get('/api/cooks/filter?maxPrice=100');
    expect(byPrice.body.cooks.map((c) => c.name)).toEqual(['Дешевий']);
  });
});

describe('Discovery — categories', () => {
  it('lists categories with dish counts', async () => {
    await createCategory({ name: 'Порожня', slug: 'empty', emoji: '🍽️' });
    await createCookWithDishes({
      categorySlug: 'borshch',
      dishes: [{ name: 'Борщ', price: 90 }, { name: 'Зелений борщ', price: 85 }],
    });

    const res = await request.get('/api/categories');
    expect(res.status).toBe(200);
    const borshch = res.body.categories.find((c) => c.slug === 'borshch');
    const empty = res.body.categories.find((c) => c.slug === 'empty');
    expect(borshch.dishCount).toBe(2);
    expect(empty.dishCount).toBe(0);
  });
});

describe('Menu & dishes', () => {
  it("returns a cook's menu grouped by category", async () => {
    const { cook } = await createCookWithDishes({
      categorySlug: 'borshch',
      dishes: [{ name: 'Червоний борщ', price: 95 }, { name: 'Зелений борщ', price: 90 }],
    });

    const res = await request.get(`/api/cooks/${cook.id}/menu`);
    expect(res.status).toBe(200);
    expect(res.body.menu).toHaveLength(1);
    expect(res.body.menu[0].category.slug).toBe('borshch');
    expect(res.body.menu[0].dishes).toHaveLength(2);
  });

  it('lists dishes and filters unavailable ones out of the menu', async () => {
    const { cook } = await createCookWithDishes({
      categorySlug: 'borshch',
      dishes: [
        { name: 'Доступна', price: 90, isAvailable: true },
        { name: 'Прихована', price: 90, isAvailable: false },
      ],
    });

    const dishes = await request.get(`/api/cooks/${cook.id}/dishes`);
    expect(dishes.body.dishes).toHaveLength(2); // dishes endpoint returns all by default

    const menu = await request.get(`/api/cooks/${cook.id}/menu`);
    const names = menu.body.menu.flatMap((g) => g.dishes.map((d) => d.name));
    expect(names).toContain('Доступна');
    expect(names).not.toContain('Прихована');
  });
});
