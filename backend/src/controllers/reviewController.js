import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createReviewSchema, listReviewsSchema, reviewReplySchema } from '../validation/schemas.js';
import { recomputeCookRating } from '../lib/reviews.js';
import { saveImage, deleteByUrl } from '../lib/storage.js';
import { createNotification } from '../lib/notify.js';

const MAX_REVIEW_PHOTOS = 5;

export function serializeReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    photos: r.photos ?? [],
    reply: r.reply,
    repliedAt: r.repliedAt,
    author: r.author ? { name: r.author.fullName } : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// POST /api/orders/:id/review — create or update the buyer's review of a
// delivered order (verified purchase; one review per order). Accepts an
// optional multipart `photos[]` (re-encoded to webp) plus a `keepPhotos` JSON
// array of already-stored URLs to retain when editing.
export async function upsertReview(req, res, next) {
  try {
    const { rating, comment } = createReviewSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.buyerId !== req.user.id) throw httpError(404, 'Замовлення не знайдено');
    if (order.status !== 'DELIVERED') throw httpError(409, 'Відгук можна залишити лише після доставки замовлення');

    const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
    const prevPhotos = existing?.photos ?? [];

    // Which already-stored photos to keep (edit path). Defaults to all existing.
    let keep = prevPhotos;
    if (req.body.keepPhotos !== undefined) {
      try {
        const parsed = JSON.parse(req.body.keepPhotos);
        if (Array.isArray(parsed)) keep = parsed.filter((u) => prevPhotos.includes(u));
      } catch {
        /* ignore malformed keepPhotos */
      }
    }

    // Persist any newly uploaded images (outside the DB transaction).
    const room = Math.max(0, MAX_REVIEW_PHOTOS - keep.length);
    const newUrls = [];
    for (const file of (req.files ?? []).slice(0, room)) {
      newUrls.push(await saveImage(file.buffer, 'reviews'));
    }
    const photos = [...keep, ...newUrls].slice(0, MAX_REVIEW_PHOTOS);

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, cookId: order.cookId, authorId: req.user.id, rating, comment: comment || null, photos },
        update: { rating, comment: comment || null, photos },
        include: { author: { select: { fullName: true } } },
      });
      await recomputeCookRating(order.cookId, tx);
      return r;
    });

    // Best-effort cleanup of dropped photos.
    for (const url of prevPhotos.filter((u) => !photos.includes(u))) {
      deleteByUrl(url).catch(() => {});
    }

    // Notify the cook of a brand-new review (not on edits).
    if (!existing) {
      const c = await prisma.cook.findUnique({ where: { id: order.cookId }, select: { userId: true } });
      await createNotification({
        userId: c?.userId,
        type: 'REVIEW_RECEIVED',
        payload: { reviewId: review.id, rating, title: 'Новий відгук', body: `Оцінка ${rating}★` },
      }).catch(() => {});
    }

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

    for (const url of review.photos ?? []) deleteByUrl(url).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Shared paginated review listing (public cook profile + cook's own page).
async function listReviewsForCook(cookId, query) {
  const { limit, offset } = listReviewsSchema.parse(query);
  const where = { cookId };
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
  return {
    reviews: reviews.map(serializeReview),
    total,
    average: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
    limit,
    offset,
  };
}

// GET /api/cooks/:id/reviews — public, paginated, newest first.
export async function listCookReviews(req, res, next) {
  try {
    res.json(await listReviewsForCook(req.params.id, req.query));
  } catch (err) {
    next(err);
  }
}

// --- Cook side (Module 5.3) -------------------------------------------------

// GET /api/cook/reviews — the authenticated cook's own reviews.
export async function listOwnReviews(req, res, next) {
  try {
    res.json(await listReviewsForCook(req.cook.id, req.query));
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/reviews/:id/reply — reply to a review on the cook's own cook.
export async function replyToReview(req, res, next) {
  try {
    const { reply } = reviewReplySchema.parse(req.body);
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review || review.cookId !== req.cook.id) throw httpError(404, 'Відгук не знайдено');

    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { reply, repliedAt: new Date() },
      include: { author: { select: { fullName: true } } },
    });
    res.json({ review: serializeReview(updated) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cook/reviews/:id/reply — remove the cook's reply.
export async function deleteReply(req, res, next) {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review || review.cookId !== req.cook.id) throw httpError(404, 'Відгук не знайдено');
    await prisma.review.update({ where: { id: review.id }, data: { reply: null, repliedAt: null } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
