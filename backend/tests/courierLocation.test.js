import { describe, it, expect } from 'vitest';
import { request, registerUser, registerActiveCook, authHeader, payOrder } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { newestPosition, recordCourierLocation, TRACKABLE } from '../src/lib/tracking.js';

// Phase 8.5 — background-safe courier location reporting.
//
// The REST endpoint and the socket handler share lib/tracking.js, so these
// cover the rules once for both transports.

async function makeCourier() {
  const reg = await registerUser({ role: 'COURIER' });
  const profile = await prisma.courierProfile.findUnique({ where: { userId: reg.user.id } });
  await prisma.courierProfile.update({ where: { id: profile.id }, data: { status: 'ONLINE' } });
  return { ...reg, courierId: profile.id };
}

// Builds a paid order carried by `courier`, parked at the given status.
async function assignedOrder(courier, status = 'COURIER_ASSIGNED') {
  const cook = await registerActiveCook();
  const buyer = await registerUser();
  const dish = await prisma.dish.create({
    data: { cookId: cook.cook.id, name: 'Борщ', price: 100, isAvailable: true },
  });
  await request
    .post('/api/cart/add')
    .set(authHeader(buyer.accessToken))
    .send({ dishId: dish.id, quantity: 1 });
  const res = await request
    .post('/api/orders')
    .set(authHeader(buyer.accessToken))
    .send({ addressText: 'вул. Тестова 5', deliveryMethod: 'COURIER' });
  await payOrder(res.body.order.id);
  const order = await prisma.order.update({
    where: { id: res.body.order.id },
    data: { courierId: courier.courierId, status },
  });
  return { order, buyer, cook };
}

const post = (token, body) =>
  request.post('/api/courier/location').set(authHeader(token)).send(body);

describe('POST /api/courier/location', () => {
  it('records the position for the assigned courier', async () => {
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier);

    const res = await post(courier.accessToken, {
      orderId: order.id,
      positions: [{ lat: 49.444, lng: 32.059 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);

    const stored = await prisma.courierLocation.findUnique({ where: { courierId: courier.courierId } });
    expect(stored.lat).toBeCloseTo(49.444);
    expect(stored.lng).toBeCloseTo(32.059);
  });

  it('persists only the newest position from a batch', async () => {
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier);

    await post(courier.accessToken, {
      orderId: order.id,
      positions: [
        { lat: 49.1, lng: 32.1, at: '2026-07-25T10:00:00.000Z' },
        { lat: 49.3, lng: 32.3, at: '2026-07-25T10:00:30.000Z' },
        { lat: 49.2, lng: 32.2, at: '2026-07-25T10:00:15.000Z' },
      ],
    });

    // Sorted by time, so an out-of-order burst can't rewind the marker.
    const stored = await prisma.courierLocation.findUnique({ where: { courierId: courier.courierId } });
    expect(stored.lat).toBeCloseTo(49.3);
  });

  it('refuses another courier\'s order without erroring', async () => {
    const owner = await makeCourier();
    const stranger = await makeCourier();
    const { order } = await assignedOrder(owner);

    const res = await post(stranger.accessToken, {
      orderId: order.id,
      positions: [{ lat: 49.4, lng: 32.0 }],
    });

    // 200 + accepted:false — a background task must not retry a legitimate refusal.
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(false);
    expect(await prisma.courierLocation.findUnique({ where: { courierId: stranger.courierId } })).toBeNull();
  });

  it('stops accepting positions once the order is delivered', async () => {
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier, 'DELIVERED');

    const res = await post(courier.accessToken, {
      orderId: order.id,
      positions: [{ lat: 49.4, lng: 32.0 }],
    });
    expect(res.body.accepted).toBe(false);
  });

  it('accepts every trackable status', async () => {
    for (const status of TRACKABLE) {
      const courier = await makeCourier();
      const { order } = await assignedOrder(courier, status);
      const res = await post(courier.accessToken, {
        orderId: order.id,
        positions: [{ lat: 49.4, lng: 32.0 }],
      });
      expect(res.body.accepted, `status ${status}`).toBe(true);
    }
  });

  it('rejects malformed bodies (schema is strict)', async () => {
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier);

    expect((await post(courier.accessToken, { orderId: order.id, positions: [] })).status).toBe(400);
    expect((await post(courier.accessToken, { orderId: 'not-a-uuid', positions: [{ lat: 1, lng: 1 }] })).status).toBe(400);
    expect((await post(courier.accessToken, { orderId: order.id, positions: [{ lat: 999, lng: 1 }] })).status).toBe(400);
    // An undeclared key fails the whole request.
    expect(
      (await post(courier.accessToken, { orderId: order.id, positions: [{ lat: 1, lng: 1 }], speed: 10 })).status,
    ).toBe(400);
  });

  it('is closed to non-couriers and to anonymous callers', async () => {
    const customer = await registerUser({ role: 'CUSTOMER' });
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier);
    const body = { orderId: order.id, positions: [{ lat: 49.4, lng: 32.0 }] };

    expect((await post(customer.accessToken, body)).status).toBe(403);
    expect((await request.post('/api/courier/location').send(body)).status).toBe(401);
  });
});

describe('shared tracking rules (used by socket and REST alike)', () => {
  it('rejects coordinates outside the valid range', async () => {
    const courier = await makeCourier();
    const { order } = await assignedOrder(courier);
    for (const [lat, lng] of [[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0]]) {
      expect(
        await recordCourierLocation({ courierId: courier.courierId, orderId: order.id, lat, lng }),
      ).toBe(false);
    }
  });

  it('rejects a missing courier or unknown order', async () => {
    const courier = await makeCourier();
    expect(await recordCourierLocation({ courierId: null, orderId: 'x', lat: 1, lng: 1 })).toBe(false);
    expect(
      await recordCourierLocation({ courierId: courier.courierId, orderId: 'nope', lat: 1, lng: 1 }),
    ).toBe(false);
  });
});

describe('newestPosition', () => {
  it('picks the latest by timestamp when all are timed', () => {
    expect(
      newestPosition([
        { lat: 1, at: '2026-07-25T10:00:10.000Z' },
        { lat: 2, at: '2026-07-25T10:00:30.000Z' },
        { lat: 3, at: '2026-07-25T10:00:20.000Z' },
      ]).lat,
    ).toBe(2);
  });

  it('falls back to arrival order when timestamps are absent', () => {
    expect(newestPosition([{ lat: 1 }, { lat: 2 }]).lat).toBe(2);
  });

  it('returns null for an empty or invalid batch', () => {
    expect(newestPosition([])).toBeNull();
    expect(newestPosition(undefined)).toBeNull();
  });
});
