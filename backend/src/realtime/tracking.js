import { Server } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

// Order statuses during which a live location is meaningful.
const TRACKABLE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

const room = (orderId) => `order:${orderId}`;

// Attach a socket.io server for realtime courier tracking.
//
// Channels are authorized:
//   • track:join {orderId}     — only the order's BUYER or its assigned COURIER
//                                may join the room; the server replies with the
//                                last known location.
//   • location:update {…}      — only the assigned COURIER may push a position,
//                                and only while the order is in a trackable
//                                status. It is persisted (last-position-only)
//                                and broadcast to that order's room.
export function initTracking(httpServer, corsOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // Handshake auth: a valid access token is required to connect at all.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      if (payload.role === 'COURIER') {
        const profile = await prisma.courierProfile.findUnique({ where: { userId: payload.sub } });
        socket.data.courierId = profile?.id || null;
      }
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
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

    // Courier pushes their current position for one of their active orders.
    socket.on('location:update', async (payload = {}) => {
      const { orderId, lat, lng } = payload;
      if (user.role !== 'COURIER' || !socket.data.courierId) return;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const order = await prisma.order.findUnique({ where: { id: String(orderId || '') } });
      if (!order || order.courierId !== socket.data.courierId || !TRACKABLE.includes(order.status)) return;

      await prisma.courierLocation.upsert({
        where: { courierId: socket.data.courierId },
        create: { courierId: socket.data.courierId, lat, lng },
        update: { lat, lng },
      });

      io.to(room(order.id)).emit('location:update', {
        orderId: order.id,
        lat,
        lng,
        updatedAt: new Date().toISOString(),
      });
    });
  });

  return io;
}
