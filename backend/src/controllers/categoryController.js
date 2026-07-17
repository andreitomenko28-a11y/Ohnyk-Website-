import { prisma } from '../lib/prisma.js';

// GET /api/categories — the two-level category tree with live dish counts.
// Top-level categories each carry their subcategories (children); a parent's
// dishCount is the sum of its subcategories' counts.
export async function listCategories(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { dishes: true } } },
    });

    const byId = new Map();
    const roots = [];
    for (const c of categories) {
      byId.set(c.id, {
        id: c.id,
        name: c.name,
        slug: c.slug,
        dishCount: c._count.dishes,
        children: [],
      });
    }
    for (const c of categories) {
      const node = byId.get(c.id);
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(node);
      else roots.push(node);
    }
    // Roll subcategory counts up into their parent.
    for (const root of roots) {
      root.dishCount += root.children.reduce((s, ch) => s + ch.dishCount, 0);
    }

    res.json({ categories: roots });
  } catch (err) {
    next(err);
  }
}
