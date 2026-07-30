import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';

// A cook with one dish + a buyer whose order with that cook is PAID.
// Paid, because the chat only opens once the order is — see getOrderConversation.
async function orderBetweenBuyerAndCook({ paid = true } = {}) {
  const { accessToken: cookToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(cookToken)).send({ name: 'Борщ', price: 100 });
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId: dish.body.dish.id, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, 1', deliveryMethod: 'PICKUP' });
  const orderId = order.body.order.id;
  if (paid) {
    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(buyer.accessToken));
    await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(buyer.accessToken))
      .send({ result: 'success' });
  }
  return { cookToken, cookUserId: cook.userId, buyer, orderId };
}

describe('In-app chat (Module 6.1)', () => {
  it('creates one conversation per order, shared by buyer and cook', async () => {
    const { cookToken, buyer, orderId } = await orderBetweenBuyerAndCook();

    const a = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    expect(a.status).toBe(200);
    expect(a.body.conversation.orderId).toBe(orderId);

    const b = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(cookToken));
    expect(b.body.conversation.id).toBe(a.body.conversation.id); // same conversation
  });

  it('blocks a non-participant from the conversation and messages', async () => {
    const { buyer, orderId } = await orderBetweenBuyerAndCook();
    const outsider = await registerUser({ role: 'CUSTOMER' });

    const convRes = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    const convId = convRes.body.conversation.id;

    expect((await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(outsider.accessToken))).status).toBe(404);
    expect((await request.get(`/api/conversations/${convId}/messages`).set(authHeader(outsider.accessToken))).status).toBe(404);
    expect(
      (await request.post(`/api/conversations/${convId}/messages`).set(authHeader(outsider.accessToken)).send({ text: 'hi' })).status,
    ).toBe(404);
  });

  it('persists messages and returns them chronologically', async () => {
    const { cookToken, buyer, orderId } = await orderBetweenBuyerAndCook();
    const convId = (await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken))).body.conversation.id;

    await request.post(`/api/conversations/${convId}/messages`).set(authHeader(buyer.accessToken)).send({ text: 'Перше' });
    await request.post(`/api/conversations/${convId}/messages`).set(authHeader(cookToken)).send({ text: 'Друге' });

    const hist = await request.get(`/api/conversations/${convId}/messages`).set(authHeader(buyer.accessToken));
    expect(hist.body.messages).toHaveLength(2);
    expect(hist.body.messages[0].text).toBe('Перше');
    expect(hist.body.messages[1].text).toBe('Друге');
  });

  it('rejects an empty message', async () => {
    const { buyer, orderId } = await orderBetweenBuyerAndCook();
    const convId = (await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken))).body.conversation.id;
    const res = await request.post(`/api/conversations/${convId}/messages`).set(authHeader(buyer.accessToken)).send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('marks the other party’s messages as read', async () => {
    const { cookToken, buyer, orderId } = await orderBetweenBuyerAndCook();
    const convId = (await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken))).body.conversation.id;
    await request.post(`/api/conversations/${convId}/messages`).set(authHeader(buyer.accessToken)).send({ text: 'Прочитай мене' });

    await request.post(`/api/conversations/${convId}/read`).set(authHeader(cookToken));

    const hist = await request.get(`/api/conversations/${convId}/messages`).set(authHeader(cookToken));
    expect(hist.body.messages[0].readAt).toBeTruthy();
  });
});

describe('The chat opens on payment, not on checkout', () => {
  it('refuses to open one for an order still awaiting payment', async () => {
    const { buyer, cookToken, orderId } = await orderBetweenBuyerAndCook({ paid: false });

    // Otherwise a cart, a checkout and no payment is a free line into any
    // cook's inbox, repeatable at will.
    const asBuyer = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    expect(asBuyer.status).toBe(409);

    // The cook cannot conjure one either.
    const asCook = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(cookToken));
    expect(asCook.status).toBe(409);
  });

  it('opens it once the order is paid', async () => {
    const { buyer, orderId } = await orderBetweenBuyerAndCook({ paid: false });
    expect((await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken))).status).toBe(409);

    await request.post(`/api/orders/${orderId}/pay`).set(authHeader(buyer.accessToken));
    await request
      .post(`/api/orders/${orderId}/pay/mock`)
      .set(authHeader(buyer.accessToken))
      .send({ result: 'success' });

    const after = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    expect(after.status).toBe(200);
    expect(after.body.conversation.orderId).toBe(orderId);
  });

  it('keeps an existing conversation reachable after the order is cancelled', async () => {
    // A refund still needs discussing, so a chat that already exists survives.
    const { buyer, cookToken, orderId } = await orderBetweenBuyerAndCook();
    const opened = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    expect(opened.status).toBe(200);

    await request
      .patch(`/api/cook/orders/${orderId}/status`)
      .set(authHeader(cookToken))
      .send({ status: 'CANCELLED' });

    const after = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(buyer.accessToken));
    expect(after.status).toBe(200);
    expect(after.body.conversation.id).toBe(opened.body.conversation.id);
  });

  it('still refuses a stranger, paid or not', async () => {
    const { orderId } = await orderBetweenBuyerAndCook();
    const stranger = await registerUser({ role: 'CUSTOMER' });
    const res = await request.get(`/api/orders/${orderId}/conversation`).set(authHeader(stranger.accessToken));
    expect(res.status).toBe(404);
  });
});
