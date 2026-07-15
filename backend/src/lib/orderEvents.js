import { prisma } from './prisma.js';

// Append a status entry to an order's timeline. Pass a transaction client to
// record the event atomically with the status change that produced it.
export async function recordOrderEvent(orderId, status, client = prisma) {
  return client.orderEvent.create({ data: { orderId, status } });
}
