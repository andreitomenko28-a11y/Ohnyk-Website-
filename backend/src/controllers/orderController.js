import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createOrderSchema, listOrdersSchema } from '../validation/schemas.js';
import { computeDeliverySlots, isValidSlot } from '../lib/deliverySlots.js';

const orderInclude = {
  items: true,
  cook: { include: { user: { select: { fullName: true } } } },
  buyer: { select: { fullName: true, phone: true } },
};

export function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    addressText: order.addressText,
    note: order.note,
    scheduledFor: order.scheduledFor,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cook: order.cook
      ? { id: order.cook.id, name: order.cook.displayName || order.cook.user?.fullName || '' }
      : { id: order.cookId },
    buyer: order.buyer ? { name: order.buyer.fullName, phone: order.buyer.phone } : undefined,
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
    const { addressId, addressText, note, scheduledFor } = createOrderSchema.parse(req.body);

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

    // Resolve the delivery address (explicit id → text → user default).
    let address = addressText;
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
    const total = Number(items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0).toFixed(2));

    // Create the order (awaiting payment) and empty the cart atomically.
    // The order becomes NEW — and the cook is notified — only after a
    // confirmed payment (Module 4.2).
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          buyerId: req.user.id,
          cookId,
          status: 'AWAITING_PAYMENT',
          total,
          addressText: address,
          note: note || null,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          items: { create: items },
        },
        include: orderInclude,
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { cookId: null } });
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
