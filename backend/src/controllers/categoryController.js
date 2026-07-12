import { prisma } from '../lib/prisma.js';

// GET /api/categories  — all categories with a live dish count.
export async function listCategories(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { dishes: true } } },
    });
    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        emoji: c.emoji,
        dishCount: c._count.dishes,
      })),
    });
  } catch (err) {
    next(err);
  }
}
