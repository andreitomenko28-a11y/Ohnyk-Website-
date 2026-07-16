import { prisma } from './prisma.js';

// Recompute a cook's aggregate rating + review count from its reviews and
// persist them onto the Cook row. Pass a transaction client to keep it atomic
// with the review change that triggered it.
export async function recomputeCookRating(cookId, client = prisma) {
  const agg = await client.review.aggregate({
    where: { cookId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const rating = agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0;
  const reviewCount = agg._count._all;
  await client.cook.update({ where: { id: cookId }, data: { rating, reviewCount } });
  return { rating, reviewCount };
}
