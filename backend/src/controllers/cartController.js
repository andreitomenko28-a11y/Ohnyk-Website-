import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import {
  addToCartSchema,
  updateCartItemSchema,
  cartTotalSchema,
} from '../validation/schemas.js';
import { computePricing } from '../lib/pricing.js';

const cartInclude = {
  items: {
    include: {
      dish: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { id: 'asc' },
  },
};

// Loads the user's cart, creating an empty one on first access.
//
// First access is routinely concurrent: the app opens and the cart badge, the
// cart screen and an "add to cart" tap all fire before any of them finishes.
// Both then find nothing and both insert, and the loser trips the unique index
// on userId — the user's very first look at their cart answering 409.
//
// Losing that insert is the expected outcome, not an error: the row the caller
// wanted exists by the time it fails, so the race is settled by reading it.
// (Prisma's upsert is not the fix here — with an empty update it does not
// compile to a single ON CONFLICT statement, and loses the same race.)
async function getOrCreateCart(userId) {
  const existing = await prisma.cart.findUnique({ where: { userId }, include: cartInclude });
  if (existing) return existing;
  try {
    await prisma.cart.create({ data: { userId } });
  } catch (err) {
    if (err.code !== 'P2002') throw err; // anything else is a real failure
  }
  return prisma.cart.findUnique({ where: { userId }, include: cartInclude });
}

// Compute item/line totals so clients don't re-derive money math.
function shapeCart(cart, deliveryFee = 0) {
  const items = cart.items.map((item) => ({
    id: item.id,
    dishId: item.dishId,
    quantity: item.quantity,
    dish: {
      id: item.dish.id,
      name: item.dish.name,
      description: item.dish.description,
      price: item.dish.price,
      image: item.dish.image,
      isAvailable: item.dish.isAvailable,
      cookId: item.dish.cookId,
      category: item.dish.category,
    },
    lineTotal: Number((item.dish.price * item.quantity).toFixed(2)),
  }));

  const subtotal = Number(items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Include the 10% customer service fee so the cart shows the real amount due.
  const pricing = computePricing(subtotal, deliveryFee);

  return {
    id: cart.id,
    cookId: cart.cookId,
    items,
    itemCount,
    subtotal,
    serviceFee: pricing.serviceFee,
    deliveryFee: pricing.deliveryFee,
    total: pricing.total,
    updatedAt: cart.updatedAt,
  };
}

// GET /api/cart
export async function getCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user.id);
    res.json({ cart: shapeCart(cart) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cart/add  { dishId, quantity }
export async function addToCart(req, res, next) {
  try {
    const { dishId, quantity } = addToCartSchema.parse(req.body);

    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) throw httpError(404, 'Страву не знайдено');
    if (!dish.isAvailable) throw httpError(409, 'Страва наразі недоступна');

    const cart = await getOrCreateCart(req.user.id);

    // One cart = one cook. Claiming the cart is a single conditional UPDATE,
    // not a read followed by a check: under READ COMMITTED two concurrent adds
    // both read cookId as null and both pass such a check, and the cart ends up
    // holding two cooks' dishes. Here Postgres serialises the two statements on
    // the row lock and the loser matches nothing.
    //
    // A standalone statement rather than the first step of an interactive
    // transaction: the row lock is then held for the statement alone instead of
    // until commit, so two contending adds never sit on each other. Nothing
    // after it needs to be atomic with it — the claim is what decides the cook,
    // and it bumps the cart's updatedAt (@updatedAt) on the way.
    const claimed = await prisma.cart.updateMany({
      where: { id: cart.id, OR: [{ cookId: null }, { cookId: dish.cookId }] },
      data: { cookId: dish.cookId },
    });
    if (claimed.count === 0) {
      throw httpError(
        409,
        'У кошику вже є страви іншого кухаря. Очистіть кошик, щоб замовити в іншого.'
      );
    }

    // Upsert the line (unique on cartId+dishId) and accumulate quantity.
    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, dishId } });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(99, existing.quantity + quantity) },
      });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, dishId, quantity } });
    }

    const fresh = await prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude });
    res.status(201).json({ cart: shapeCart(fresh) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/cart/:itemId  { quantity }  — quantity 0 removes the item.
export async function updateCartItem(req, res, next) {
  try {
    const { quantity } = updateCartItemSchema.parse(req.body);

    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude });
    const item = cart?.items.find((i) => i.id === req.params.itemId);
    if (!item) throw httpError(404, 'Позицію кошика не знайдено');

    if (quantity === 0) {
      await removeItemAndMaybeClearCook(cart.id, item.id);
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }

    const fresh = await prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude });
    res.json({ cart: shapeCart(fresh) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart/:itemId
export async function removeCartItem(req, res, next) {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude });
    const item = cart?.items.find((i) => i.id === req.params.itemId);
    if (!item) throw httpError(404, 'Позицію кошика не знайдено');

    await removeItemAndMaybeClearCook(cart.id, item.id);

    const fresh = await prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude });
    res.json({ cart: shapeCart(fresh) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart  — empty the cart.
export async function clearCart(req, res, next) {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (cart) {
      await prisma.$transaction([
        prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
        prisma.cart.update({ where: { id: cart.id }, data: { cookId: null } }),
      ]);
    }
    const fresh = await getOrCreateCart(req.user.id);
    res.json({ cart: shapeCart(fresh) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cart/total  { deliveryFee? }  — subtotal + delivery.
export async function cartTotal(req, res, next) {
  try {
    const { deliveryFee } = cartTotalSchema.parse(req.body ?? {});
    const cart = await getOrCreateCart(req.user.id);
    const shaped = shapeCart(cart, deliveryFee);
    res.json({
      itemCount: shaped.itemCount,
      subtotal: shaped.subtotal,
      serviceFee: shaped.serviceFee,
      deliveryFee: shaped.deliveryFee,
      total: shaped.total,
    });
  } catch (err) {
    next(err);
  }
}

// Deletes an item; if the cart becomes empty, detach its cook.
async function removeItemAndMaybeClearCook(cartId, itemId) {
  await prisma.cartItem.delete({ where: { id: itemId } });
  const remaining = await prisma.cartItem.count({ where: { cartId } });
  if (remaining === 0) {
    await prisma.cart.update({ where: { id: cartId }, data: { cookId: null } });
  }
}
