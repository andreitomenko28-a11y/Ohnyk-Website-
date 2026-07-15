import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  request,
  registerCook,
  registerActiveCook,
  createCategory,
  authHeader,
} from './helpers.js';

async function jpeg() {
  return sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 210, g: 140, b: 60 } } })
    .jpeg()
    .toBuffer();
}

describe('Cook menu management (Module 3.2)', () => {
  it('creates a dish with schedule and validates price > 0', async () => {
    const { accessToken } = await registerActiveCook();
    const cat = await createCategory({ slug: 'borshch', name: 'Борщ' });

    const ok = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({
        name: 'Деруни',
        description: 'Зі сметаною',
        price: 80,
        categoryId: cat.id,
        availableDays: ['MON', 'WED', 'FRI'],
        availableFrom: '10:00',
        availableUntil: '18:00',
      });
    expect(ok.status).toBe(201);
    expect(ok.body.dish.name).toBe('Деруни');
    expect(ok.body.dish.availableDays).toEqual(['MON', 'WED', 'FRI']);
    expect(ok.body.dish.category.slug).toBe('borshch');

    const zero = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Безкоштовне', price: 0 });
    expect(zero.status).toBe(400);
  });

  it('rejects an invalid time format and unknown category', async () => {
    const { accessToken } = await registerActiveCook();
    const badTime = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Страва', price: 50, availableFrom: '25:99' });
    expect(badTime.status).toBe(400);

    const badCat = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Страва', price: 50, categoryId: '11111111-1111-1111-1111-111111111111' });
    expect(badCat.status).toBe(400);
  });

  it('blocks a pending (unverified) cook from creating dishes', async () => {
    const { accessToken } = await registerCook();
    const res = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Страва', price: 50 });
    expect(res.status).toBe(403);
  });

  it('lists, updates and deletes own dishes', async () => {
    const { accessToken } = await registerActiveCook();
    const created = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Борщ', price: 90 });
    const id = created.body.dish.id;

    const list = await request.get('/api/cook/dishes').set(authHeader(accessToken));
    expect(list.body.total).toBe(1);

    const upd = await request
      .put(`/api/cook/dishes/${id}`)
      .set(authHeader(accessToken))
      .send({ price: 95, isAvailable: false });
    expect(upd.status).toBe(200);
    expect(upd.body.dish.price).toBe(95);
    expect(upd.body.dish.isAvailable).toBe(false);

    const del = await request.delete(`/api/cook/dishes/${id}`).set(authHeader(accessToken));
    expect(del.status).toBe(200);
    const after = await request.get('/api/cook/dishes').set(authHeader(accessToken));
    expect(after.body.total).toBe(0);
  });

  it('prevents editing another cook’s dish', async () => {
    const a = await registerActiveCook();
    const b = await registerActiveCook();
    const dish = await request
      .post('/api/cook/dishes')
      .set(authHeader(a.accessToken))
      .send({ name: 'Моя страва', price: 70 });

    const res = await request
      .put(`/api/cook/dishes/${dish.body.dish.id}`)
      .set(authHeader(b.accessToken))
      .send({ price: 1 });
    expect(res.status).toBe(404);
  });

  it('uploads multiple photos (resized) and sets/promotes the cover', async () => {
    const { accessToken } = await registerActiveCook();
    const dish = await request
      .post('/api/cook/dishes')
      .set(authHeader(accessToken))
      .send({ name: 'Вареники', price: 85 });
    const id = dish.body.dish.id;

    const up = await request
      .post(`/api/cook/dishes/${id}/photos`)
      .set(authHeader(accessToken))
      .attach('photos', await jpeg(), 'a.jpg')
      .attach('photos', await jpeg(), 'b.jpg');
    expect(up.status).toBe(201);
    expect(up.body.dish.photos).toHaveLength(2);
    expect(up.body.dish.image).toMatch(/^\/uploads\/dishes\/.*\.webp$/);

    const firstPhotoId = up.body.dish.photos[0].id;
    const cover = up.body.dish.image;

    const del = await request
      .delete(`/api/cook/dishes/${id}/photos/${firstPhotoId}`)
      .set(authHeader(accessToken));
    expect(del.status).toBe(200);
    expect(del.body.dish.photos).toHaveLength(1);
    // Cover was the removed photo → promoted to the remaining one.
    expect(del.body.dish.image).not.toBe(cover);
  });
});
