import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';

// Places an order and drives it to DELIVERED through the real endpoints so the
// notification triggers (new order + status changes) actually fire.
async function deliveredOrderReal() {
  const { accessToken: cookToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(cookToken)).send({ name: 'Борщ', price: 100 });
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId: dish.body.dish.id, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, 1', deliveryMethod: 'PICKUP' });
  const orderId = order.body.order.id;
  await request.post(`/api/orders/${orderId}/pay`).set(authHeader(buyer.accessToken)).send({});
  await request.post(`/api/orders/${orderId}/pay/mock`).set(authHeader(buyer.accessToken)).send({ result: 'success' });
  for (const status of ['PREPARING', 'READY', 'DELIVERED']) {
    await request.patch(`/api/cook/orders/${orderId}/status`).set(authHeader(cookToken)).send({ status });
  }
  return { cookToken, cookId: cook.id, buyer, orderId };
}

const list = (token) => request.get('/api/notifications').set(authHeader(token));

describe('Notifications (Module 6.3)', () => {
  it('notifies the buyer on status changes and the cook on a new order', async () => {
    const { cookToken, buyer, orderId } = await deliveredOrderReal();

    const buyerN = await list(buyer.accessToken);
    expect(buyerN.body.notifications.some((n) => n.type === 'ORDER_STATUS' && n.payload.status === 'DELIVERED')).toBe(true);
    expect(buyerN.body.unreadCount).toBeGreaterThan(0);

    const cookN = await list(cookToken);
    expect(cookN.body.notifications.some((n) => n.type === 'NEW_ORDER' && n.payload.orderId === orderId)).toBe(true);
  });

  it('notifies the cook of a new review', async () => {
    const { cookToken, buyer, orderId } = await deliveredOrderReal();
    await request.post(`/api/orders/${orderId}/review`).set(authHeader(buyer.accessToken)).send({ rating: 5 });

    const cookN = await list(cookToken);
    expect(cookN.body.notifications.some((n) => n.type === 'REVIEW_RECEIVED')).toBe(true);
  });

  it('marks notifications read and blocks cross-user access', async () => {
    const { buyer } = await deliveredOrderReal();
    const outsider = await registerUser({ role: 'CUSTOMER' });
    const one = (await list(buyer.accessToken)).body.notifications[0];

    expect((await request.patch(`/api/notifications/${one.id}/read`).set(authHeader(outsider.accessToken))).status).toBe(404);
    expect((await request.patch(`/api/notifications/${one.id}/read`).set(authHeader(buyer.accessToken))).status).toBe(204);

    await request.post('/api/notifications/read-all').set(authHeader(buyer.accessToken));
    expect((await list(buyer.accessToken)).body.unreadCount).toBe(0);
  });

  it('links Telegram via a /start deep-link token', async () => {
    const buyer = await registerUser({ role: 'CUSTOMER' });
    const link = await request.post('/api/notifications/telegram/link').set(authHeader(buyer.accessToken));
    expect(link.body.url).toMatch(/t\.me\/.+\?start=/);

    const wh = await request
      .post('/api/notifications/telegram/webhook')
      .send({ message: { chat: { id: 12345 }, text: `/start ${link.body.token}` } });
    expect(wh.status).toBe(200);

    const status = await request.get('/api/notifications/telegram/status').set(authHeader(buyer.accessToken));
    expect(status.body.linked).toBe(true);
  });
});
