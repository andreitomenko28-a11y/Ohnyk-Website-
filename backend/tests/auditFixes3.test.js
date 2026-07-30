import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

// Fifth audit pass. Every case was reproduced against a running server before
// the fix; the races are looped because one round can pass on luck alone.

describe('The cart survives two first-touches at once', () => {
  it('does not answer 409 to whichever request loses the insert', async () => {
    for (let round = 0; round < 5; round++) {
      const user = await registerUser();
      const get = () => request.get('/api/cart').set(authHeader(user.accessToken));
      const [r1, r2] = await Promise.all([get(), get()]);

      // Both find no cart, both insert, and the loser used to trip the unique
      // index on userId — the user's first ever look at their cart, 409.
      expect([r1.status, r2.status]).toEqual([200, 200]);
      expect(await prisma.cart.count({ where: { userId: user.user.id } })).toBe(1);
    }
  });
});

describe('Two favourites added at once both survive', () => {
  it('keeps both instead of losing one to a stale array', async () => {
    const a = await registerActiveCook();
    const b = await registerActiveCook();

    for (let round = 0; round < 5; round++) {
      const user = await registerUser();
      const fav = (id) => request.put(`/api/users/favorites/${id}`).set(authHeader(user.accessToken));
      await Promise.all([fav(a.cook.id), fav(b.cook.id)]);

      const res = await request.get('/api/users/favorites').set(authHeader(user.accessToken));
      expect(res.status).toBe(200);
      // Read-modify-write on the String[] column dropped whichever write landed
      // first: both requests read the same array and the second overwrote it.
      expect(res.body.cooks.map((c) => c.id).sort()).toEqual([a.cook.id, b.cook.id].sort());
    }
  });

  it('stays idempotent and still removes', async () => {
    const cook = await registerActiveCook();
    const user = await registerUser();
    const fav = () => request.put(`/api/users/favorites/${cook.cook.id}`).set(authHeader(user.accessToken));

    await fav();
    const twice = await fav();
    expect(twice.body.user.favoriteCookIds.filter((id) => id === cook.cook.id)).toHaveLength(1);

    const removed = await request
      .delete(`/api/users/favorites/${cook.cook.id}`)
      .set(authHeader(user.accessToken));
    expect(removed.body.user.favoriteCookIds).not.toContain(cook.cook.id);
  });

  it('404s on a cook that does not exist', async () => {
    const user = await registerUser();
    const res = await request
      .put('/api/users/favorites/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user.accessToken));
    expect(res.status).toBe(404);
  });
});

describe('Analytics dates are validated, not handed to the database', () => {
  async function admin() {
    const user = await registerUser();
    await prisma.user.update({ where: { id: user.user.id }, data: { role: 'ADMIN' } });
    return user;
  }

  it('rejects a date-shaped string that is not a date', async () => {
    const a = await admin();
    const res = await request
      .get('/api/admin/analytics?dateFrom=2026-13-45')
      .set(authHeader(a.accessToken));
    expect(res.status).toBe(400); // was 500 — Invalid Date reached Prisma
  });

  it('rejects outright junk', async () => {
    const a = await admin();
    const res = await request.get('/api/admin/analytics?dateTo=junk').set(authHeader(a.accessToken));
    expect(res.status).toBe(400);
  });

  it('still accepts both a plain day and a full timestamp', async () => {
    const a = await admin();
    for (const q of ['dateFrom=2026-01-01', `dateFrom=${new Date().toISOString()}`]) {
      const res = await request.get(`/api/admin/analytics?${q}`).set(authHeader(a.accessToken));
      expect(res.status).toBe(200);
    }
  });
});

describe('The open courier pool does not hand out the buyer', () => {
  it('omits buyer name and phone from orders nobody has claimed', async () => {
    const cook = await registerActiveCook();
    const buyer = await registerUser({ phone: `+38050${Math.floor(1000000 + Math.random() * 8999999)}` });
    const dish = await prisma.dish.create({
      data: { cookId: cook.cook.id, name: `Плов ${Math.random()}`, price: 150 },
    });
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.user.id,
        cookId: cook.cook.id,
        status: 'READY',
        deliveryMethod: 'COURIER',
        subtotal: 150,
        total: 165,
        addressText: 'вул. Таємна, 7, кв. 42',
        items: { create: { dishId: dish.id, nameSnapshot: dish.name, priceSnapshot: 150, quantity: 1 } },
      },
    });

    const courier = await registerUser({ role: 'COURIER' });
    await request
      .patch('/api/courier/status')
      .set(authHeader(courier.accessToken))
      .send({ status: 'ONLINE' });

    const pool = await request
      .get('/api/courier/orders/available')
      .set(authHeader(courier.accessToken));
    const listed = pool.body.orders.find((o) => o.id === order.id);

    expect(listed).toBeTruthy();
    expect(listed.buyer).toBeUndefined(); // every online courier could read this
    // The address stays: it is what the courier is being asked to accept.
    expect(listed.addressText).toBe('вул. Таємна, 7, кв. 42');
  });

  it('reveals the buyer once the courier has actually claimed it', async () => {
    const cook = await registerActiveCook();
    const buyer = await registerUser({ phone: `+38050${Math.floor(1000000 + Math.random() * 8999999)}` });
    const dish = await prisma.dish.create({
      data: { cookId: cook.cook.id, name: `Узвар ${Math.random()}`, price: 60 },
    });
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.user.id,
        cookId: cook.cook.id,
        status: 'READY',
        deliveryMethod: 'COURIER',
        subtotal: 60,
        total: 66,
        addressText: 'вул. Відкрита, 1',
        items: { create: { dishId: dish.id, nameSnapshot: dish.name, priceSnapshot: 60, quantity: 1 } },
      },
    });

    const courier = await registerUser({ role: 'COURIER' });
    await request
      .patch('/api/courier/status')
      .set(authHeader(courier.accessToken))
      .send({ status: 'ONLINE' });
    const claimed = await request
      .post(`/api/courier/orders/${order.id}/claim`)
      .set(authHeader(courier.accessToken));

    expect(claimed.status).toBe(200);
    expect(claimed.body.order.buyer?.name).toBeTruthy(); // needed to hand it over
  });
});

describe('Two pay taps at the same instant both land on an invoice', () => {
  it('does not answer 409 to the one that loses the insert', async () => {
    const cook = await registerActiveCook();
    const dish = await prisma.dish.create({
      data: { cookId: cook.cook.id, name: `Голубці ${Math.random()}`, price: 90 },
    });

    for (let round = 0; round < 5; round++) {
      const buyer = await registerUser();
      await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId: dish.id });
      const checkout = await request
        .post('/api/orders')
        .set(authHeader(buyer.accessToken))
        .send({ addressText: 'вул. Тестова, 9', deliveryMethod: 'COURIER' });
      const orderId = checkout.body.order.id;

      const pay = () => request.post(`/api/orders/${orderId}/pay`).set(authHeader(buyer.accessToken));
      const [r1, r2] = await Promise.all([pay(), pay()]);

      expect([r1.status, r2.status]).toEqual([200, 200]);
      expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    }
  });
});
