// Realtime hub — a thin holder for the shared socket.io instance so REST
// controllers can emit to rooms without importing the server wiring.
let io = null;

export function setIO(instance) {
  io = instance;
}

// Broadcast a newly-persisted chat message to a conversation's room.
export function emitChatMessage(conversationId, message) {
  io?.to(`conversation:${conversationId}`).emit('chat:message', { conversationId, message });
}

// Push a notification to a user's personal room (Phase 6.3).
export function emitNotification(userId, notification) {
  io?.to(`user:${userId}`).emit('notification:new', { notification });
}

// Whether a user currently has at least one live socket (used to decide if an
// out-of-app notification is needed).
export function isUserOnline(userId) {
  const room = io?.sockets.adapter.rooms.get(`user:${userId}`);
  return !!room && room.size > 0;
}
