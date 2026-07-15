import { describe, it, expect } from 'vitest';
import { request, registerUser, authHeader, createCookWithDishes } from './helpers.js';

async function setup() {
  const customer = await registerUser();
  const { cook, dishes } = await createCookWithDishes({
    categorySlug: 'borshch',
    dishes: [
      { name: 'Борщ', price: 90 },
      { name: 'Вареники', price: 85 },
    ],
  });
  return { customer, cook, dishes, auth: authHeader(customer.accessToken) };
}

describe('Cart', () => {
  it('requires auth', async () => {
    const res = await request.get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('starts empty', async () => {
    const { auth } = await setup();
    const res = await request.get('/api/cart').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(0);
    expect(res.body.cart.subtotal).toBe(0);
    expect(res.body.cart.cookId).toBeNull();
  });

  it('adds items and accumulates quantity for the same dish', async () => {
    const { auth, dishes, cook } = await setup();
    await request.post('/api/cart/add').set(auth).send({ dishId: dishes[0].id, quantity: 2 });
    const res = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: dishes[0].id, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(3);
    expect(res.body.cart.itemCount).toBe(3);
    expect(res.body.cart.subtotal).toBe(270);
    expect(res.body.cart.cookId).toBe(cook.id);
  });

  it('computes subtotal across multiple dishes', async () => {
    const { auth, dishes } = await setup();
    await request.post('/api/cart/add').set(auth).send({ dishId: dishes[0].id, quantity: 1 });
    const res = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: dishes[1].id, quantity: 2 });
    expect(res.body.cart.subtotal).toBe(90 + 85 * 2);
  });

  it("rejects dishes from a second cook (one cook per cart)", async () => {
    const { auth, dishes } = await setup();
    const other = await createCookWithDishes({ dishes: [{ name: 'Плов', price: 120 }] });
    await request.post('/api/cart/add').set(auth).send({ dishId: dishes[0].id, quantity: 1 });

    const res = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: other.dishes[0].id, quantity: 1 });
    expect(res.status).toBe(409);
  });

  it('updates quantity and removes at quantity 0', async () => {
    const { auth, dishes } = await setup();
    const add = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: dishes[0].id, quantity: 1 });
    const itemId = add.body.cart.items[0].id;

    const patch = await request.patch(`/api/cart/${itemId}`).set(auth).send({ quantity: 5 });
    expect(patch.body.cart.items[0].quantity).toBe(5);

    const zero = await request.patch(`/api/cart/${itemId}`).set(auth).send({ quantity: 0 });
    expect(zero.body.cart.items).toHaveLength(0);
    expect(zero.body.cart.cookId).toBeNull();
  });

  it('removes an item and clears the cart', async () => {
    const { auth, dishes } = await setup();
    const add = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: dishes[0].id, quantity: 1 });
    const itemId = add.body.cart.items[0].id;

    const del = await request.delete(`/api/cart/${itemId}`).set(auth);
    expect(del.status).toBe(200);
    expect(del.body.cart.items).toHaveLength(0);

    await request.post('/api/cart/add').set(auth).send({ dishId: dishes[1].id, quantity: 2 });
    const clear = await request.delete('/api/cart').set(auth);
    expect(clear.body.cart.items).toHaveLength(0);
    expect(clear.body.cart.cookId).toBeNull();
  });

  it('calculates total with a delivery fee', async () => {
    const { auth, dishes } = await setup();
    await request.post('/api/cart/add').set(auth).send({ dishId: dishes[0].id, quantity: 2 });
    const res = await request.post('/api/cart/total').set(auth).send({ deliveryFee: 50 });
    expect(res.body.subtotal).toBe(180);
    expect(res.body.serviceFee).toBe(18); // 10% customer fee
    expect(res.body.deliveryFee).toBe(50);
    expect(res.body.total).toBe(248); // 180 + 18 + 50
  });

  it('404s on a missing dish and on a foreign cart item', async () => {
    const { auth } = await setup();
    const missing = await request
      .post('/api/cart/add')
      .set(auth)
      .send({ dishId: 'nope', quantity: 1 });
    expect(missing.status).toBe(404);

    const foreign = await request.patch('/api/cart/nope').set(auth).send({ quantity: 1 });
    expect(foreign.status).toBe(404);
  });
});
