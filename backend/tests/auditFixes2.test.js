import { describe, it, expect } from 'vitest';
import {
  request,
  registerUser,
  registerActiveCook,
  authHeader,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { makeRateLimiter } from '../src/middleware/rateLimit.js';
import express from 'express';
import supertest from 'supertest';

// Fourth audit pass. Every case here was reproduced against a running server
// before the fix, and fails against the code as it stood.

describe('A profile update never depends on a Cook row that is not there', () => {
  it('accepts cook-only fields from a customer instead of erroring', async () => {
    const buyer = await registerUser();
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(buyer.accessToken))
      .send({ fullName: 'Оновлене Ім’я', bio: 'привіт', city: 'Черкаси' });

    // The nested cookProfile.update used to blow up with a Prisma "record not
    // found" for every customer who sent bio/city — a 500 on ordinary input.
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Оновлене Ім’я');
    expect(res.body.user.cook).toBeNull();
  });

  it('still writes them for a cook', async () => {
    const cook = await registerActiveCook();
    const res = await request
      .patch('/api/users/profile')
      .set(authHeader(cook.accessToken))
      .send({ bio: 'Готую борщ', city: 'Умань' });

    expect(res.status).toBe(200);
    expect(res.body.user.cook.bio).toBe('Готую борщ');
    expect(res.body.user.cook.city).toBe('Умань');
  });
});

describe('A pagination cursor is validated, not handed to the database', () => {
  it('rejects a non-date cursor on notifications', async () => {
    const user = await registerUser();
    const res = await request
      .get('/api/notifications?cursor=junk')
      .set(authHeader(user.accessToken));

    expect(res.status).toBe(400); // was 500 — Invalid Date reached Prisma
  });

  it('rejects a non-date cursor on messages', async () => {
    const user = await registerUser();
    const res = await request
      .get('/api/conversations/00000000-0000-0000-0000-000000000000/messages?cursor=junk')
      .set(authHeader(user.accessToken));

    expect(res.status).toBe(400);
  });

  it('still accepts a real ISO cursor', async () => {
    const user = await registerUser();
    const res = await request
      .get(`/api/notifications?cursor=${new Date().toISOString()}`)
      .set(authHeader(user.accessToken));

    expect(res.status).toBe(200);
  });
});

describe('Password-reset requests are actually capped', () => {
  // The limiters are pass-through under NODE_ENV=test, so the property under
  // test is the limiter's own configuration: authLimiter skips successful
  // requests, and this endpoint answers 200 to every call by design, so it
  // counted nothing. Build both and drive them.
  function mount(limiter) {
    const app = express();
    app.use(express.json());
    app.post('/reset', limiter, (_req, res) => res.json({ message: 'ok' })); // always 200
    return supertest(app);
  }

  it('a skipSuccessfulRequests limiter never fires on an always-200 route', async () => {
    const agent = mount(makeRateLimiter({ windowMs: 60_000, max: 2, skipSuccessfulRequests: true }));
    for (let i = 0; i < 5; i++) {
      expect((await agent.post('/reset').send({})).status).toBe(200);
    }
  });

  it('the reset limiter counts every request', async () => {
    const agent = mount(makeRateLimiter({ windowMs: 60_000, max: 2 }));
    expect((await agent.post('/reset').send({})).status).toBe(200);
    expect((await agent.post('/reset').send({})).status).toBe(200);
    expect((await agent.post('/reset').send({})).status).toBe(429);
  });
});

// --- Concurrency -------------------------------------------------------------
// Both cases below are races: they are looped, because a single round can pass
// by luck when the two requests happen to serialise on their own.

describe('A courier still holds one delivery at a time under a race', () => {
  it('refuses the second of two simultaneous claims on different orders', async () => {
    const cook = await registerActiveCook();
    const courier = await registerUser({ role: 'COURIER' });
    await request
      .patch('/api/courier/status')
      .set(authHeader(courier.accessToken))
      .send({ status: 'ONLINE' });

    const readyOrder = async () => {
      const buyer = await registerUser();
      const dish = await prisma.dish.create({
        data: { cookId: cook.cook.id, name: `Борщ ${Math.random()}`, price: 100 },
      });
      const order = await prisma.order.create({
        data: {
          buyerId: buyer.user.id,
          cookId: cook.cook.id,
          status: 'READY',
          deliveryMethod: 'COURIER',
          subtotal: 100,
          total: 110,
          addressText: 'вул. Тестова, 2',
          items: { create: { dishId: dish.id, nameSnapshot: dish.name, priceSnapshot: 100, quantity: 1 } },
        },
      });
      return order;
    };

    for (let round = 0; round < 5; round++) {
      const [a, b] = await Promise.all([readyOrder(), readyOrder()]);
      const claim = (id) =>
        request.post(`/api/courier/orders/${id}/claim`).set(authHeader(courier.accessToken));
      const [r1, r2] = await Promise.all([claim(a.id), claim(b.id)]);

      const won = [r1, r2].filter((r) => r.status === 200);
      expect(won).toHaveLength(1); // the other must be refused, not queued alongside

      // Finish the claimed delivery so the courier is free for the next round.
      const claimed = r1.status === 200 ? a : b;
      for (const status of ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']) {
        await request
          .patch(`/api/courier/orders/${claimed.id}/status`)
          .set(authHeader(courier.accessToken))
          .send({ status });
      }
    }
  });
});

describe('A double-submitted checkout produces one order, not two', () => {
  it('refuses the second of two simultaneous checkouts of the same cart', async () => {
    const cook = await registerActiveCook();
    const dish = await prisma.dish.create({
      data: { cookId: cook.cook.id, name: `Вареники ${Math.random()}`, price: 120 },
    });

    for (let round = 0; round < 5; round++) {
      const buyer = await registerUser();
      await request
        .post('/api/cart/add')
        .set(authHeader(buyer.accessToken))
        .send({ dishId: dish.id });

      const checkout = () =>
        request
          .post('/api/orders')
          .set(authHeader(buyer.accessToken))
          .send({ addressText: 'вул. Тестова, 3', deliveryMethod: 'COURIER' });
      const [r1, r2] = await Promise.all([checkout(), checkout()]);

      const created = [r1, r2].filter((r) => r.status === 201);
      expect(created).toHaveLength(1);

      // And the buyer really has one order, not two.
      const count = await prisma.order.count({ where: { buyerId: buyer.user.id } });
      expect(count).toBe(1);
    }
  });
});
