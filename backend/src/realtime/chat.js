import { prisma } from '../lib/prisma.js';

const room = (conversationId) => `conversation:${conversationId}`;

// True if `userId` is a participant (buyer or the cook's user) of a conversation.
export async function isConversationParticipant(conversationId, userId) {
  if (!conversationId) return false;
  const conv = await prisma.conversation.findUnique({
    where: { id: String(conversationId) },
    include: { cook: { select: { userId: true } } },
  });
  if (!conv) return false;
  return conv.buyerId === userId || conv.cook?.userId === userId;
}

// Register realtime chat handlers on an already-authenticated socket.
//   • chat:join {conversationId} — participant-only; joins the conversation room.
//   • chat:leave {conversationId}
// Messages themselves are sent over REST (persisted there) and broadcast to the
// room by the controller via hub.emitChatMessage — the socket is delivery-only.
export function registerChat(io, socket) {
  const { user } = socket.data;

  socket.on('chat:join', async (conversationId, ack) => {
    if (!(await isConversationParticipant(conversationId, user.id))) {
      return ack?.({ ok: false, error: 'forbidden' });
    }
    socket.join(room(conversationId));
    ack?.({ ok: true });
  });

  socket.on('chat:leave', (conversationId) => {
    if (conversationId) socket.leave(room(conversationId));
  });
}
