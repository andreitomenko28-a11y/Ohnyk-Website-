import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createOrderSchema, listOrdersSchema } from '../validation/schemas.js';
import { computeDeliverySlots, isValidSlot } from '../lib/deliverySlots.js';
import { computePricing } from '../lib/pricing.js';

const orderInclude = {
  items: true,
  cook: { include: { user: { select: { fullName: true } } } },
  buyer: { select: { fullName: true, phone: true } },
  courier: { include: { user: { select: { fullName: true, phone: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  review: true,
};

export function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    subtotal: order.subtotal,
    serviceFee: order.serviceFee,
    total: order.total,
    cookPayout: order.cookPayout,
    commission: order.commission,
    deliveryMethod: order.deliveryMethod,
    addressText: order.addressText,
    deliveryLat: order.deliveryLat ?? null,
    deliveryLng: order.deliveryLng ?? null,
    note: order.note,
    scheduledFor: order.scheduledFor,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    timeline: (order.events ?? []).map((e) => ({ status: e.status, at: e.createdAt })),
    // Buyer's own review + whether they may leave one (delivered, not yet
    // reviewed). Only meaningful when the review relation was loaded — for
    // cook/courier serializations it isn't, so canReview stays false there.
    review: order.review
      ? {
          id: order.review.id,
          rating: order.review.rating,
          comment: order.review.comment,
          photos: order.review.photos ?? [],
          reply: order.review.reply,
        }
      : null,
    canReview: order.review !== undefined && order.status === 'DELIVERED' && !order.review,
    cook: order.cook
      ? { id: order.cook.id, name: order.cook.displayName || order.cook.user?.fullName || '' }
      : { id: order.cookId },
    buyer: order.buyer ? { name: order.buyer.fullName, phone: order.buyer.phone } : undefined,
    courier: order.courier
      ? {
          id: order.courier.id,
          name: order.courier.user?.fullName || '',
          phone: order.courier.user?.phone || null,
          transport: order.courier.transport,
        }
      : null,
    items: (order.items ?? []).map((i) => ({
      id: i.id,
      dishId: i.dishId,
      name: i.nameSnapshot,
      price: i.priceSnapshot,
      quantity: i.quantity,
      lineTotal: Number((i.priceSnapshot * i.quantity).toFixed(2)),
    })),
  };
}

function formatAddress(a) {
  const apt = a.apartment ? `, кв. ${a.apartment}` : '';
  return `${a.city}, ${a.street}, ${a.building}${apt}`;
}

// GET /api/orders/delivery-slots — available delivery times for the current cart.
export async function deliverySlots(req, res, next) {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { dish: true } } },
    });
    if (!cart || cart.items.length === 0) throw httpError(400, 'Кошик порожній');
    const dishes = cart.items.map((it) => it.dish);
    res.json({ days: computeDeliverySlots(dishes) });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders — checkout the current cart into an order (awaiting payment).
export async function checkout(req, res, next) {
  try {
    const { addressId, addressText, note, scheduledFor, deliveryMethod } = createOrderSchema.parse(req.body);

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { dish: true } } },
    });
    if (!cart || cart.items.length === 0) throw httpError(400, 'Кошик порожній');

    const cookId = cart.cookId ?? cart.items[0].dish.cookId;
    const cook = await prisma.cook.findUnique({ where: { id: cookId } });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');
    if (cook.verificationStatus !== 'VERIFIED' || cook.status !== 'ACTIVE') {
      throw httpError(403, 'Цей кухар зараз не приймає замовлення');
    }

    // Reject if any dish went out of stock while it sat in the cart.
    const unavailable = cart.items.filter((it) => !it.dish.isAvailable);
    if (unavailable.length) {
      throw httpError(
        409,
        `Деякі страви вже недоступні: ${unavailable.map((it) => it.dish.name).join(', ')}`,
      );
    }

    // Resolve the address. For pickup we store the cook's kitchen address as the
    // collection point; otherwise the buyer's delivery address (id → text → default).
    let address;
    if (deliveryMethod === 'PICKUP') {
      address = cook.kitchenAddress || cook.city || 'Самовивіз';
    } else {
      address = addressText;
      if (addressId) {
        const a = await prisma.address.findUnique({ where: { id: addressId } });
        if (!a || a.userId !== req.user.id) throw httpError(400, 'Адресу не знайдено');
        address = formatAddress(a);
      } else if (!address) {
        const def = await prisma.address.findFirst({
          where: { userId: req.user.id },
          orderBy: { isDefault: 'desc' },
        });
        if (def) address = formatAddress(def);
      }
      if (!address) throw httpError(400, 'Вкажіть адресу доставки');
    }

    // Validate the chosen delivery slot against the dishes' availability.
    if (scheduledFor && !isValidSlot(cart.items.map((it) => it.dish), scheduledFor)) {
      throw httpError(400, 'Обраний час доставки недоступний');
    }

    const items = cart.items.map((it) => ({
      dishId: it.dishId,
      nameSnapshot: it.dish.name,
      priceSnapshot: it.dish.price,
      quantity: it.quantity,
    }));
    const subtotal = Number(items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0).toFixed(2));
    const pricing = computePricing(subtotal);

    // Create the order (awaiting payment) and empty the cart atomically.
    // The order becomes NEW — and the cook is notified — only after a
    // confirmed payment (Module 4.2).
    //
    // Emptying the cart comes FIRST and doubles as the claim on it. A
    // double-submitted checkout (two taps, a retry, a flaky connection) runs
    // two of these concurrently; both read the same cart items outside the
    // transaction and would each write an order for them, leaving the buyer
    // with two orders and two invoices for one meal. The delete takes row locks
    // on the items, so the second attempt waits, finds them already gone, and
    // is refused instead of duplicating the order.
    const order = await prisma.$transaction(async (tx) => {
      const cleared = await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (cleared.count === 0) throw httpError(409, 'Кошик уже оформлено');
      await tx.cart.update({ where: { id: cart.id }, data: { cookId: null } });

      const created = await tx.order.create({
        data: {
          buyerId: req.user.id,
          cookId,
          status: 'AWAITING_PAYMENT',
          subtotal: pricing.subtotal,
          serviceFee: pricing.serviceFee,
          total: pricing.total,
          cookPayout: pricing.cookPayout,
          commission: pricing.commission,
          deliveryMethod,
          addressText: address,
          note: note || null,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          items: { create: items },
        },
        include: orderInclude,
      });
      const ev = await tx.orderEvent.create({ data: { orderId: created.id, status: 'AWAITING_PAYMENT' } });
      created.events = [ev]; // include the just-created event in the response
      return created;
    });

    res.status(201).json({ order: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders — the buyer's own orders (newest first).
export async function listMyOrders(req, res, next) {
  try {
    const { status, limit, offset } = listOrdersSchema.parse(req.query);
    const where = { buyerId: req.user.id, ...(status ? { status } : {}) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders: orders.map(serializeOrder), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id — a single order owned by the buyer.
export async function getMyOrder(req, res, next) {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    res.json({ order: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
}
