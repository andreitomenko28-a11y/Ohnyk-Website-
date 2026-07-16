import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createReviewSchema, listReviewsSchema } from '../validation/schemas.js';
import { recomputeCookRating } from '../lib/reviews.js';

export function serializeReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    repliedAt: r.repliedAt,
    author: r.author ? { name: r.author.fullName } : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// POST /api/orders/:id/review — create or update the buyer's review of a
// delivered order (verified purchase; one review per order).
export async function upsertReview(req, res, next) {
  try {
    const { rating, comment } = createReviewSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    if (order.status !== 'DELIVERED') throw httpError(409, 'Відгук можна залишити лише після доставки замовлення');

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, cookId: order.cookId, authorId: req.user.id, rating, comment: comment || null },
        update: { rating, comment: comment || null },
        include: { author: { select: { fullName: true } } },
      });
      await recomputeCookRating(order.cookId, tx);
      return r;
    });

    res.status(201).json({ review: serializeReview(review) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/orders/:id/review — remove the buyer's own review.
export async function deleteReview(req, res, next) {
  try {
    const review = await prisma.review.findUnique({ where: { orderId: req.params.id } });
    if (!review || review.authorId !== req.user.id) throw httpError(404, 'Відгук не знайдено');

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: review.id } });
      await recomputeCookRating(review.cookId, tx);
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// GET /api/cooks/:id/reviews — public, paginated, newest first.
export async function listCookReviews(req, res, next) {
  try {
    const { limit, offset } = listReviewsSchema.parse(req.query);
    const where = { cookId: req.params.id };
    const [reviews, total, agg] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);
    res.json({
      reviews: reviews.map(serializeReview),
      total,
      average: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
}
