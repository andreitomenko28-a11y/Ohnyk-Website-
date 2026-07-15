import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import {
  listCooksSchema,
  searchCooksSchema,
  filterCooksSchema,
  listDishesSchema,
} from '../validation/schemas.js';

// Include the owning user's public name + a lightweight dish summary.
const cookInclude = {
  user: { select: { fullName: true } },
  dishes: { where: { isAvailable: true }, select: { price: true, categoryId: true } },
};

// Shape a cook for list/detail responses.
function publicCook(cook) {
  const prices = cook.dishes?.map((d) => d.price) ?? [];
  return {
    id: cook.id,
    name: cook.user?.fullName ?? '',
    bio: cook.bio,
    avatar: cook.avatar,
    isVerified: cook.isVerified,
    rating: cook.rating,
    reviewCount: cook.reviewCount,
    city: cook.city,
    latitude: cook.latitude,
    longitude: cook.longitude,
    dishCount: prices.length,
    priceFrom: prices.length ? Math.min(...prices) : null,
    createdAt: cook.createdAt,
  };
}

// GET /api/cooks  — paginated list, highest rated first.
export async function listCooks(req, res, next) {
  try {
    const { limit, offset } = listCooksSchema.parse(req.query);
    const [cooks, total] = await Promise.all([
      prisma.cook.findMany({
        include: cookInclude,
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.cook.count(),
    ]);
    res.json({ cooks: cooks.map(publicCook), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/cooks/search?q=  — search by cook name or bio.
export async function searchCooks(req, res, next) {
  try {
    const { q, limit, offset } = searchCooksSchema.parse(req.query);
    const where = q
      ? {
          OR: [
            { bio: { contains: q, mode: 'insensitive' } },
            { user: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {};

    const [cooks, total] = await Promise.all([
      prisma.cook.findMany({
        where,
        include: cookInclude,
        orderBy: [{ rating: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.cook.count({ where }),
    ]);
    res.json({ cooks: cooks.map(publicCook), total, limit, offset, query: q });
  } catch (err) {
    next(err);
  }
}

// GET /api/cooks/filter  — category / price / rating / city.
export async function filterCooks(req, res, next) {
  try {
    const { category, minPrice, maxPrice, minRating, city, limit, offset } =
      filterCooksSchema.parse(req.query);

    // Build a dish filter used to select cooks that have a matching dish.
    const dishWhere = { isAvailable: true };
    if (category) dishWhere.category = { is: { slug: category } };
    if (minPrice !== undefined || maxPrice !== undefined) {
      dishWhere.price = {};
      if (minPrice !== undefined) dishWhere.price.gte = minPrice;
      if (maxPrice !== undefined) dishWhere.price.lte = maxPrice;
    }

    const where = {};
    if (minRating !== undefined) where.rating = { gte: minRating };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    // Only constrain by dishes when a dish-level filter was supplied.
    const hasDishFilter =
      category || minPrice !== undefined || maxPrice !== undefined;
    if (hasDishFilter) where.dishes = { some: dishWhere };

    const [cooks, total] = await Promise.all([
      prisma.cook.findMany({
        where,
        include: cookInclude,
        orderBy: [{ rating: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.cook.count({ where }),
    ]);
    res.json({ cooks: cooks.map(publicCook), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/cooks/:id  — single cook profile.
export async function getCook(req, res, next) {
  try {
    const cook = await prisma.cook.findUnique({
      where: { id: req.params.id },
      include: cookInclude,
    });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');
    // Detail view also exposes the pickup point + delivery zone (used at checkout).
    res.json({
      cook: { ...publicCook(cook), kitchenAddress: cook.kitchenAddress, deliveryZone: cook.deliveryZone },
    });
  } catch (err) {
    next(err);
  }
}

// Shared dish loader for menu/dishes endpoints.
async function loadDishes(cookId, { category, available, limit, offset }) {
  const cook = await prisma.cook.findUnique({ where: { id: cookId } });
  if (!cook) throw httpError(404, 'Кухаря не знайдено');

  const where = { cookId };
  if (category) where.category = { is: { slug: category } };
  if (available !== undefined) where.isAvailable = available;

  const dishes = await prisma.dish.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, slug: true, emoji: true } },
      photos: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, sortOrder: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });
  return { cook, dishes };
}

// GET /api/cooks/:cookId/dishes  — flat dish list (with filters).
export async function listCookDishes(req, res, next) {
  try {
    const params = listDishesSchema.parse(req.query);
    const { dishes } = await loadDishes(req.params.cookId, params);
    res.json({ dishes });
  } catch (err) {
    next(err);
  }
}

// GET /api/cooks/:cookId/menu  — dishes grouped by category.
export async function getCookMenu(req, res, next) {
  try {
    const params = listDishesSchema.parse(req.query);
    const { cook, dishes } = await loadDishes(req.params.cookId, {
      ...params,
      available: params.available ?? true, // menu shows available dishes by default
    });

    const groups = new Map();
    for (const dish of dishes) {
      const key = dish.category?.slug ?? 'other';
      if (!groups.has(key)) {
        groups.set(key, {
          category: dish.category ?? { id: null, name: 'Інше', slug: 'other', emoji: '🍽️' },
          dishes: [],
        });
      }
      groups.get(key).dishes.push(dish);
    }

    res.json({ cookId: cook.id, menu: [...groups.values()] });
  } catch (err) {
    next(err);
  }
}

export { publicCook };
