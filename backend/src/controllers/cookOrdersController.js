import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { listOrdersSchema, updateOrderStatusSchema } from '../validation/schemas.js';
import { serializeOrder } from './orderController.js';
import { notifyOrderStatus } from '../lib/notify.js';
import { recordOrderEvent } from '../lib/orderEvents.js';

const orderInclude = {
  items: true,
  buyer: { select: { fullName: true, phone: true } },
  courier: { include: { user: { select: { fullName: true, phone: true } } } },
};

// Allowed forward transitions the cook may perform, per delivery method.
//   • COURIER       — the cook stops at READY; a courier takes over delivery.
//   • COOK_DELIVERY — the cook delivers: READY → ON_THE_WAY → DELIVERED.
//   • PICKUP        — the customer collects: READY → DELIVERED (handed over).
function cookTransitions(order) {
  const t = {
    NEW: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: [],
    ON_THE_WAY: [],
  };
  if (order.deliveryMethod === 'PICKUP') {
    t.READY = ['DELIVERED'];
  } else if (order.deliveryMethod === 'COOK_DELIVERY') {
    t.READY = ['ON_THE_WAY'];
    t.ON_THE_WAY = ['DELIVERED'];
  }
  return t;
}

// GET /api/cook/orders — incoming (paid) orders for the cook. Unpaid orders
// (AWAITING_PAYMENT) are never shown.
export async function listCookOrders(req, res, next) {
  try {
    const { status, limit, offset } = listOrdersSchema.parse(req.query);
    const where = {
      cookId: req.cook.id,
      ...(status ? { status } : { status: { not: 'AWAITING_PAYMENT' } }),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders: orders.map(serializeOrder), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/cook/orders/:id — a single incoming order.
export async function getCookOrder(req, res, next) {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order || order.cookId !== req.cook.id) throw httpError(404, 'Замовлення не знайдено');
    res.json({ order: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/cook/orders/:id/status — advance the order status.
export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = updateOrderStatusSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.cookId !== req.cook.id) throw httpError(404, 'Замовлення не знайдено');

    if (order.status === status) throw httpError(400, 'Замовлення вже в цьому статусі');
    if (!cookTransitions(order)[order.status]?.includes(status)) {
      throw httpError(400, `Неможливий перехід статусу: ${order.status} → ${status}`);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status },
      include: orderInclude,
    });
    await recordOrderEvent(order.id, status);
    await notifyOrderStatus({ order: updated });
    res.json({ order: serializeOrder(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/cook/stats — simple dashboard stats.
export async function cookStats(req, res, next) {
  try {
    const cookId = req.cook.id;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6); // last 7 days, inclusive

    const orders = await prisma.order.findMany({ where: { cookId }, include: { items: true } });
    // Exclude unpaid and cancelled orders from stats.
    const active = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'AWAITING_PAYMENT');
    // Revenue is the cook's net earnings — after the 10% app commission.
    const sum = (arr) => Number(arr.reduce((s, o) => s + o.cookPayout, 0).toFixed(2));

    const todayOrders = active.filter((o) => o.createdAt >= startToday);
    const weekOrders = active.filter((o) => o.createdAt >= startWeek);

    // Top dishes by quantity across non-cancelled orders.
    const counts = {};
    for (const o of active) {
      for (const i of o.items) counts[i.nameSnapshot] = (counts[i.nameSnapshot] || 0) + i.quantity;
    }
    const topDishes = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    // Counts by status (for dashboard badges).
    const byStatus = {};
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

    res.json({
      newCount: byStatus.NEW || 0,
      ordersToday: todayOrders.length,
      ordersWeek: weekOrders.length,
      ordersTotal: active.length,
      revenueToday: sum(todayOrders),
      revenueWeek: sum(weekOrders),
      revenueTotal: sum(active),
      topDishes,
      byStatus,
    });
  } catch (err) {
    next(err);
  }
}
