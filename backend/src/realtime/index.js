import { Server } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { setIO } from './hub.js';
import { registerTracking } from './tracking.js';
import { registerChat } from './chat.js';

// Single socket.io server shared by all realtime features (courier tracking +
// in-app chat + notifications). A valid access token is required to connect;
// per-feature room authorization happens inside each handler.
export function initRealtime(httpServer, corsOrigins) {
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
    // Personal room for per-user pushes (notifications, presence).
    socket.join(`user:${socket.data.user.id}`);
    registerTracking(io, socket);
    registerChat(io, socket);
  });

  setIO(io);
  return io;
}
