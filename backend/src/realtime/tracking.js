import { prisma } from '../lib/prisma.js';
import { recordCourierLocation } from '../lib/tracking.js';

const room = (orderId) => `order:${orderId}`;

// Register realtime courier-tracking handlers on an already-authenticated
// socket. The shared io + handshake auth live in realtime/index.js.
//
// Channels are authorized:
//   • track:join {orderId}     — only the order's BUYER or its assigned COURIER
//                                may join the room; the server replies with the
//                                last known location.
//   • location:update {…}      — only the assigned COURIER may push a position,
//                                and only while the order is in a trackable
//                                status. It is persisted (last-position-only)
//                                and broadcast to that order's room.
export function registerTracking(io, socket) {
  const { user } = socket.data;

  async function authorizedOrder(orderId) {
    if (!orderId) return null;
    const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
    if (!order) return null;
    const isBuyer = order.buyerId === user.id;
    const isCourier = socket.data.courierId && order.courierId === socket.data.courierId;
    return isBuyer || isCourier ? order : null;
  }

  // Join an order's tracking room (buyer or assigned courier only).
  socket.on('track:join', async (orderId, ack) => {
    const order = await authorizedOrder(orderId);
    if (!order) return ack?.({ ok: false, error: 'forbidden' });
    socket.join(room(order.id));

    const loc = order.courierId
      ? await prisma.courierLocation.findUnique({ where: { courierId: order.courierId } })
      : null;
    ack?.({
      ok: true,
      status: order.status,
      location: loc ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt } : null,
    });
  });

  socket.on('track:leave', (orderId) => {
    if (orderId) socket.leave(room(orderId));
  });

  // Courier pushes their current position for one of their active orders while
  // the app is in the foreground. Authorization, persistence and the broadcast
  // all live in lib/tracking.js, shared with POST /api/courier/location so the
  // two transports cannot drift apart.
  socket.on('location:update', async (payload = {}) => {
    if (user.role !== 'COURIER') return;
    const { orderId, lat, lng } = payload;
    await recordCourierLocation({ courierId: socket.data.courierId, orderId, lat, lng });
  });
}
