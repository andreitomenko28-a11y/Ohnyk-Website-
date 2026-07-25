import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import {
  courierStatusSchema,
  courierAdvanceSchema,
  courierLocationSchema,
  listOrdersSchema,
} from '../validation/schemas.js';
import { serializeOrder } from './orderController.js';
import { notifyOrderStatus } from '../lib/notify.js';
import { recordOrderEvent } from '../lib/orderEvents.js';
import { newestPosition, recordCourierLocation } from '../lib/tracking.js';

const orderInclude = {
  items: true,
  cook: { include: { user: { select: { fullName: true } } } },
  buyer: { select: { fullName: true, phone: true } },
  courier: { include: { user: { select: { fullName: true, phone: true } } } },
};

// Forward transitions a courier may perform on their own delivery.
const TRANSITIONS = {
  COURIER_ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['ON_THE_WAY'],
  ON_THE_WAY: ['DELIVERED'],
};

// Statuses that count as an in-progress delivery for the courier.
const ACTIVE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

function serializeCourier(c) {
  return { id: c.id, status: c.status, transport: c.transport };
}

// GET /api/courier/me — the courier's own profile.
export async function getMe(req, res, next) {
  try {
    res.json({ courier: serializeCourier(req.courier) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/courier/status — toggle availability and/or set transport.
export async function updateStatus(req, res, next) {
  try {
    const data = courierStatusSchema.parse(req.body);
    if (data.status === undefined && data.transport === undefined) {
      throw httpError(400, 'Нема що оновлювати');
    }
    const courier = await prisma.courierProfile.update({
      where: { id: req.courier.id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.transport !== undefined ? { transport: data.transport } : {}),
      },
    });
    res.json({ courier: serializeCourier(courier) });
  } catch (err) {
    next(err);
  }
}

// GET /api/courier/orders/available — READY orders no courier has claimed yet.
export async function listAvailable(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'READY', courierId: null, deliveryMethod: 'COURIER' },
      include: orderInclude,
      orderBy: { scheduledFor: { sort: 'asc', nulls: 'first' } },
      take: 50,
    });
    res.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    next(err);
  }
}

// GET /api/courier/orders — the courier's own deliveries (active by default).
export async function listMine(req, res, next) {
  try {
    const { status, limit, offset } = listOrdersSchema.parse(req.query);
    const where = {
      courierId: req.courier.id,
      ...(status ? { status } : { status: { in: [...ACTIVE, 'DELIVERED'] } }),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { updatedAt: 'desc' }, take: limit, skip: offset }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders: orders.map(serializeOrder), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// POST /api/courier/orders/:id/claim — self-assign a READY order.
export async function claimOrder(req, res, next) {
  try {
    if (req.courier.status !== 'ONLINE') {
      throw httpError(409, 'Перейдіть онлайн, щоб брати замовлення');
    }

    // Atomic claim: only succeeds if the order is still READY, unclaimed, and
    // actually opted in for third-party courier delivery.
    const result = await prisma.order.updateMany({
      where: { id: req.params.id, status: 'READY', courierId: null, deliveryMethod: 'COURIER' },
      data: { status: 'COURIER_ASSIGNED', courierId: req.courier.id },
    });
    if (result.count === 0) {
      throw httpError(409, 'Замовлення вже взяв інший кур’єр або воно недоступне');
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    await recordOrderEvent(order.id, 'COURIER_ASSIGNED');
    await notifyOrderStatus({ order });
    res.json({ order: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/courier/orders/:id/status — advance an own delivery.
export async function advanceStatus(req, res, next) {
  try {
    const { status } = courierAdvanceSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.courierId !== req.courier.id) throw httpError(404, 'Замовлення не знайдено');

    if (order.status === status) throw httpError(400, 'Замовлення вже в цьому статусі');
    if (!TRANSITIONS[order.status]?.includes(status)) {
      throw httpError(400, `Неможливий перехід статусу: ${order.status} → ${status}`);
    }

    const updated = await prisma.order.update({ where: { id: order.id }, data: { status }, include: orderInclude });
    await recordOrderEvent(order.id, status);
    await notifyOrderStatus({ order: updated });
    res.json({ order: serializeOrder(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/courier/location — background-safe position reporting.
//
// A backgrounded app cannot hold a socket open (the OS suspends the JS
// runtime), so the location task posts here instead. It sends a batch, since
// the task is woken in bursts; only the newest position is persisted because
// CourierLocation keeps one row per courier.
//
// A refused report (order finished, reassigned, not this courier's) answers
// 200 with accepted:false rather than an error status — it is a legitimate
// outcome, and a background task must not treat it as something to retry.
export async function reportLocation(req, res, next) {
  try {
    const { orderId, positions } = courierLocationSchema.parse(req.body);
    const latest = newestPosition(positions);
    const accepted = await recordCourierLocation({
      courierId: req.courier.id,
      orderId,
      lat: latest.lat,
      lng: latest.lng,
    });
    res.json({ accepted });
  } catch (err) {
    next(err);
  }
}
