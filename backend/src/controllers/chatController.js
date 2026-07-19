import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { sendMessageSchema, listMessagesSchema } from '../validation/schemas.js';
import { isConversationParticipant } from '../realtime/chat.js';
import { emitChatMessage, isUserOnline } from '../realtime/hub.js';
import { createNotification } from '../lib/notify.js';

function serializeConversation(c) {
  return {
    id: c.id,
    orderId: c.orderId,
    buyerId: c.buyerId,
    cookId: c.cookId,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
  };
}

function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

// Loads a conversation and throws 404 unless the current user is a participant.
async function participantConversationOrThrow(conversationId, userId) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { cook: { select: { userId: true } } },
  });
  if (!conv || (conv.buyerId !== userId && conv.cook?.userId !== userId)) {
    throw httpError(404, 'Розмову не знайдено');
  }
  return conv;
}

// GET /api/orders/:orderId/conversation — get or lazily create the order's chat.
export async function getOrderConversation(req, res, next) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { cook: { select: { userId: true } } },
    });
    if (!order) throw httpError(404, 'Замовлення не знайдено');
    const isBuyer = order.buyerId === req.user.id;
    const isCook = order.cook?.userId === req.user.id;
    if (!isBuyer && !isCook) throw httpError(404, 'Замовлення не знайдено');

    // Upsert avoids a race between two participants opening the chat at once.
    const conv = await prisma.conversation.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, buyerId: order.buyerId, cookId: order.cookId },
      update: {},
    });
    res.json({ conversation: serializeConversation(conv) });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/messages?cursor=&limit= — cursor-based history,
// newest page first, returned in chronological order.
export async function listMessages(req, res, next) {
  try {
    const { cursor, limit } = listMessagesSchema.parse(req.query);
    await participantConversationOrThrow(req.params.id, req.user.id);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

    res.json({ messages: messages.reverse().map(serializeMessage), nextCursor });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages — send a message (persist + broadcast).
export async function sendMessage(req, res, next) {
  try {
    const { text } = sendMessageSchema.parse(req.body);
    const conv = await participantConversationOrThrow(req.params.id, req.user.id);

    const message = await prisma.message.create({
      data: { conversationId: req.params.id, senderId: req.user.id, text },
    });
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { lastMessageAt: message.createdAt },
    });

    const serialized = serializeMessage(message);
    emitChatMessage(req.params.id, serialized); // live-deliver to the room

    // Notify the other participant only when they aren't currently connected.
    const recipientId = conv.buyerId === req.user.id ? conv.cook?.userId : conv.buyerId;
    if (recipientId && !isUserOnline(recipientId)) {
      createNotification({
        userId: recipientId,
        type: 'NEW_MESSAGE',
        payload: { conversationId: conv.id, orderId: conv.orderId, title: 'Нове повідомлення', body: text.slice(0, 80) },
      }).catch(() => {});
    }

    res.status(201).json({ message: serialized });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/read — mark the other party's messages as read.
export async function markRead(req, res, next) {
  try {
    await participantConversationOrThrow(req.params.id, req.user.id);
    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
