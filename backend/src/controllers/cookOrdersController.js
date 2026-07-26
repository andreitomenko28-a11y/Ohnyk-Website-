import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { listOrdersSchema, updateOrderStatusSchema } from '../validation/schemas.js';
import { serializeOrder } from './orderController.js';
import { notifyOrderStatus } from '../lib/notify.js';
import { recordOrderEvent } from '../lib/orderEvents.js';
import { markRefundDue } from '../lib/refunds.js';

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

    // Cancelling an order the buyer already paid for leaves their money with
    // us. Both writes go in one transaction, so a cancelled order can never
    // exist without the refund it owes.
    const { updated, refund } = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: order.id },
        data: { status },
        include: orderInclude,
      });
      const owed =
        status === 'CANCELLED'
          ? await markRefundDue(order.id, 'Замовлення скасував кухар', tx)
          : null;
      return { updated: next, refund: owed };
    });

    await recordOrderEvent(order.id, status);
    await notifyOrderStatus({ order: updated });
    res.json({ order: serializeOrder(updated), refundPending: !!refund });
  } catch (err) {
    next(err);
  }
}

// Orders excluded from revenue/volume stats (unpaid + cancelled).
const STATS_EXCLUDED = ['CANCELLED', 'AWAITING_PAYMENT'];

// GET /api/cook/stats — dashboard stats, aggregated in the database so a cook
// with a large order history doesn't have to be loaded into memory.
export async function cookStats(req, res, next) {
  try {
    const cookId = req.cook.id;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6); // last 7 days, inclusive

    const activeWhere = { cookId, status: { notIn: STATS_EXCLUDED } };
    const round = (n) => Number((n || 0).toFixed(2));
    // Revenue is the cook's net earnings (cookPayout) — after the app commission.
    const agg = (where) =>
      prisma.order.aggregate({ where, _count: { _all: true }, _sum: { cookPayout: true } });

    const [total, today, week, statusGroups, dishGroups] = await Promise.all([
      agg(activeWhere),
      agg({ ...activeWhere, createdAt: { gte: startToday } }),
      agg({ ...activeWhere, createdAt: { gte: startWeek } }),
      prisma.order.groupBy({ by: ['status'], where: { cookId }, _count: { _all: true } }),
      prisma.orderItem.groupBy({
        by: ['nameSnapshot'],
        where: { order: { is: activeWhere } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const byStatus = {};
    for (const g of statusGroups) byStatus[g.status] = g._count._all;

    const topDishes = dishGroups.map((g) => ({ name: g.nameSnapshot, qty: g._sum.quantity || 0 }));

    res.json({
      newCount: byStatus.NEW || 0,
      ordersToday: today._count._all,
      ordersWeek: week._count._all,
      ordersTotal: total._count._all,
      revenueToday: round(today._sum.cookPayout),
      revenueWeek: round(week._sum.cookPayout),
      revenueTotal: round(total._sum.cookPayout),
      topDishes,
      byStatus,
    });
  } catch (err) {
    next(err);
  }
}
