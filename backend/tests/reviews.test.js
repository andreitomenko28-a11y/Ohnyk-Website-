import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { request, registerUser, registerActiveCook, authHeader, payOrder } from './helpers.js';

const jpeg = (color) => sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).jpeg().toBuffer();

async function cookWithDish() {
  const { accessToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(accessToken)).send({ name: 'Борщ', price: 100 });
  return { cookToken: accessToken, cookId: cook.id, dishId: dish.body.dish.id };
}

// Place → pay → drive to DELIVERED (pickup path). Returns buyer token + order id.
async function deliveredOrder(cookToken, dishId) {
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, 1', deliveryMethod: 'PICKUP' });
  const id = order.body.order.id;
  await payOrder(id);
  for (const status of ['PREPARING', 'READY', 'DELIVERED']) {
    await request.patch(`/api/cook/orders/${id}/status`).set(authHeader(cookToken)).send({ status });
  }
  return { buyerToken: buyer.accessToken, orderId: id };
}

const cookRating = async (cookId) => (await request.get(`/api/cooks/${cookId}`)).body.cook;

describe('Reviews & ratings (Module 5.1)', () => {
  it('lets a buyer review a delivered order and updates the cook aggregate', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);

    const res = await request
      .post(`/api/orders/${orderId}/review`)
      .set(authHeader(buyerToken))
      .send({ rating: 5, comment: 'Смачно!' });
    expect(res.status).toBe(201);
    expect(res.body.review).toMatchObject({ rating: 5, comment: 'Смачно!' });

    const cook = await cookRating(cookId);
    expect(cook.rating).toBe(5);
    expect(cook.reviewCount).toBe(1);
  });

  it('averages multiple reviews into the cook rating', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const a = await deliveredOrder(cookToken, dishId);
    const b = await deliveredOrder(cookToken, dishId);
    await request.post(`/api/orders/${a.orderId}/review`).set(authHeader(a.buyerToken)).send({ rating: 5 });
    await request.post(`/api/orders/${b.orderId}/review`).set(authHeader(b.buyerToken)).send({ rating: 4 });

    const cook = await cookRating(cookId);
    expect(cook.reviewCount).toBe(2);
    expect(cook.rating).toBe(4.5);
  });

  it('updates an existing review and recomputes the average', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);
    await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 2 });
    await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 5, comment: 'Виправились!' });

    const list = await request.get(`/api/cooks/${cookId}/reviews`);
    expect(list.body.total).toBe(1); // still one review (upsert, not duplicate)
    expect(list.body.reviews[0]).toMatchObject({ rating: 5, comment: 'Виправились!' });
    expect((await cookRating(cookId)).rating).toBe(5);
  });

  it('removes a review and recomputes (back to 0 when none remain)', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);
    await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 4 });

    const del = await request.delete(`/api/orders/${orderId}/review`).set(authHeader(buyerToken));
    expect(del.status).toBe(204);
    const cook = await cookRating(cookId);
    expect(cook.reviewCount).toBe(0);
    expect(cook.rating).toBe(0);
  });

  it('rejects reviewing an order that is not delivered', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const buyer = await registerUser({ role: 'CUSTOMER' });
    await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId, quantity: 1 });
    const order = await request.post('/api/orders').set(authHeader(buyer.accessToken)).send({ addressText: 'Черкаси, 1' });
    await payOrder(order.body.order.id); // NEW, not delivered
    const res = await request.post(`/api/orders/${order.body.order.id}/review`).set(authHeader(buyer.accessToken)).send({ rating: 5 });
    expect(res.status).toBe(409);
  });

  it('forbids reviewing someone else’s order and validates the rating', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { orderId } = await deliveredOrder(cookToken, dishId);
    const stranger = await registerUser({ role: 'CUSTOMER' });
    const foreign = await request.post(`/api/orders/${orderId}/review`).set(authHeader(stranger.accessToken)).send({ rating: 5 });
    expect(foreign.status).toBe(404);

    const { buyerToken, orderId: mine } = await deliveredOrder(cookToken, dishId);
    const bad = await request.post(`/api/orders/${mine}/review`).set(authHeader(buyerToken)).send({ rating: 9 });
    expect(bad.status).toBe(400);
  });

  it('exposes review + canReview on the order and lists cook reviews publicly', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);

    const before = await request.get(`/api/orders/${orderId}`).set(authHeader(buyerToken));
    expect(before.body.order.canReview).toBe(true);
    expect(before.body.order.review).toBe(null);

    await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 5, comment: 'Топ' });

    const after = await request.get(`/api/orders/${orderId}`).set(authHeader(buyerToken));
    expect(after.body.order.canReview).toBe(false);
    expect(after.body.order.review).toMatchObject({ rating: 5, comment: 'Топ' });

    // Public list — no auth required.
    const list = await request.get(`/api/cooks/${cookId}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.average).toBe(5);
    expect(list.body.reviews[0].author.name).toBeTruthy();
  });
});

describe('Cook replies to reviews (Module 5.3)', () => {
  it('lets the cook list, reply to, and clear a reply on their own review', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);
    const created = await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 5, comment: 'Смачно' });
    const reviewId = created.body.review.id;

    // Cook sees it in their own review list.
    const own = await request.get('/api/cook/reviews').set(authHeader(cookToken));
    expect(own.body.total).toBe(1);
    expect(own.body.reviews[0].id).toBe(reviewId);

    // Cook replies.
    const reply = await request.post(`/api/cook/reviews/${reviewId}/reply`).set(authHeader(cookToken)).send({ reply: 'Дякуємо!' });
    expect(reply.status).toBe(200);
    expect(reply.body.review.reply).toBe('Дякуємо!');

    // The reply is visible on the public list.
    const pub = await request.get(`/api/cooks/${cookId}/reviews`);
    expect(pub.body.reviews[0].reply).toBe('Дякуємо!');

    // Cook clears the reply.
    const del = await request.delete(`/api/cook/reviews/${reviewId}/reply`).set(authHeader(cookToken));
    expect(del.status).toBe(204);
    const after = await request.get(`/api/cooks/${cookId}/reviews`);
    expect(after.body.reviews[0].reply).toBe(null);
  });

  it('forbids a cook from replying to another cook’s review', async () => {
    const a = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(a.cookToken, a.dishId);
    const created = await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 4 });
    const other = await registerActiveCook();

    const res = await request
      .post(`/api/cook/reviews/${created.body.review.id}/reply`)
      .set(authHeader(other.accessToken))
      .send({ reply: 'Не моє' });
    expect(res.status).toBe(404);
  });

  it('rejects an empty reply', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);
    const created = await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).send({ rating: 5 });
    const res = await request.post(`/api/cook/reviews/${created.body.review.id}/reply`).set(authHeader(cookToken)).send({ reply: '' });
    expect(res.status).toBe(400);
  });
});

describe('Review photos (Module 6.2)', () => {
  it('attaches uploaded photos (re-encoded to webp) and exposes them publicly', async () => {
    const { cookToken, cookId, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);

    const res = await request
      .post(`/api/orders/${orderId}/review`)
      .set(authHeader(buyerToken))
      .field('rating', '5')
      .field('comment', 'Смачно, з фото')
      .attach('photos', await jpeg('red'), 'a.jpg')
      .attach('photos', await jpeg('green'), 'b.jpg');

    expect(res.status).toBe(201);
    expect(res.body.review.photos).toHaveLength(2);
    expect(res.body.review.photos.every((u) => u.endsWith('.webp'))).toBe(true);

    const pub = await request.get(`/api/cooks/${cookId}/reviews`);
    expect(pub.body.reviews[0].photos).toHaveLength(2);
  });

  it('keeps only the selected photos when editing', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);

    const first = await request
      .post(`/api/orders/${orderId}/review`)
      .set(authHeader(buyerToken))
      .field('rating', '4')
      .attach('photos', await jpeg('red'), 'a.jpg')
      .attach('photos', await jpeg('blue'), 'b.jpg');
    const [keep] = first.body.review.photos;

    const edited = await request
      .post(`/api/orders/${orderId}/review`)
      .set(authHeader(buyerToken))
      .field('rating', '4')
      .field('keepPhotos', JSON.stringify([keep]));

    expect(edited.body.review.photos).toEqual([keep]);
  });

  it('rejects more than 5 photos', async () => {
    const { cookToken, dishId } = await cookWithDish();
    const { buyerToken, orderId } = await deliveredOrder(cookToken, dishId);

    let req = request.post(`/api/orders/${orderId}/review`).set(authHeader(buyerToken)).field('rating', '5');
    for (let i = 0; i < 6; i++) req = req.attach('photos', await jpeg('red'), `p${i}.jpg`);
    const res = await req;

    expect(res.status).toBe(400); // multer maxCount=5 → hard limit
  });
});
