// Courier position recording.
//
// Shared by the socket handler (realtime/tracking.js) and the REST endpoint
// (POST /api/courier/location) so both paths enforce exactly the same rules:
// only the order's assigned courier may report a position, and only while the
// order is in a status where a live location means anything. Keeping this in
// one place is the point — two copies of an authorization rule drift.
//
// A REST path exists alongside the socket because a backgrounded app cannot
// hold a socket open: the OS suspends the JS runtime, and the background
// location task is woken only in short bursts.

import { prisma } from './prisma.js';
import { emitCourierLocation } from '../realtime/hub.js';

// Statuses during which a live location is meaningful.
export const TRACKABLE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

const validCoordinate = (lat, lng) =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

// Persists the courier's latest position for one of their active orders and
// broadcasts it to that order's room. Returns false when the report is refused
// (wrong courier, unknown order, order no longer trackable, bad coordinates) —
// callers treat that as "ignore", never as an error worth retrying.
export async function recordCourierLocation({ courierId, orderId, lat, lng }) {
  if (!courierId || !validCoordinate(lat, lng)) return false;

  const order = await prisma.order.findUnique({ where: { id: String(orderId || '') } });
  if (!order || order.courierId !== courierId || !TRACKABLE.includes(order.status)) return false;

  // Last-position-only: CourierLocation holds one row per courier.
  await prisma.courierLocation.upsert({
    where: { courierId },
    create: { courierId, lat, lng },
    update: { lat, lng },
  });

  emitCourierLocation(order.id, {
    orderId: order.id,
    lat,
    lng,
    updatedAt: new Date().toISOString(),
  });

  return true;
}

// A background task delivers positions in bursts. Only the newest one is worth
// persisting, since the model keeps a single position per courier — but the
// batch is sorted first so an out-of-order burst can't rewind the marker.
export function newestPosition(positions = []) {
  if (!Array.isArray(positions) || positions.length === 0) return null;
  const timed = positions.filter((p) => p && typeof p.at === 'string');
  if (timed.length === positions.length && positions.length > 1) {
    return [...positions].sort((a, b) => new Date(a.at) - new Date(b.at)).at(-1);
  }
  return positions.at(-1);
}
