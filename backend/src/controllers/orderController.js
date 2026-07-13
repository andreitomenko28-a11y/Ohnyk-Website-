import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createOrderSchema, listOrdersSchema } from '../validation/schemas.js';
import { notifyNewOrder } from '../lib/notify.js';

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

// POST /api/orders — checkout the current cart into an order.
export async function checkout(req, res, next) {
  try {
    const { addressId, addressText, note } = createOrderSchema.parse(req.body);

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

    const items = cart.items.map((it) => ({
      dishId: it.dishId,
      nameSnapshot: it.dish.name,
      priceSnapshot: it.dish.price,
      quantity: it.quantity,
    }));
    const total = Number(items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0).toFixed(2));

    // Create the order and empty the cart atomically.
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          buyerId: req.user.id,
          cookId,
          status: 'NEW',
          total,
          addressText: address,
          note: note || null,
          items: { create: items },
        },
        include: orderInclude,
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { cookId: null } });
      return created;
    });

    await notifyNewOrder({ cook, order });
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
