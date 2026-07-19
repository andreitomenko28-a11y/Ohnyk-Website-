import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader } from './helpers.js';

// A cook with one dish + a buyer who has placed an order with that cook.
async function orderBetweenBuyerAndCook() {
  const { accessToken: cookToken, cook } = await registerActiveCook();
  const dish = await request.post('/api/cook/dishes').set(authHeader(cookToken)).send({ name: 'Борщ', price: 100 });
  const buyer = await registerUser({ role: 'CUSTOMER' });
  await request.post('/api/cart/add').set(authHeader(buyer.accessToken)).send({ dishId: dish.body.dish.id, quantity: 1 });
  const order = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'Черкаси, 1', deliveryMethod: 'PICKUP' });
  return { cookToken, cookUserId: cook.userId, buyer, orderId: order.body.order.id };
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
