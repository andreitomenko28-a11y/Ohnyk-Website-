import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { saveImage, deleteByUrl } from '../lib/storage.js';
import { createDishSchema, updateDishSchema } from '../validation/schemas.js';

const MAX_PHOTOS = 8;

const dishInclude = {
  category: { select: { id: true, name: true, slug: true, emoji: true } },
  photos: { orderBy: { sortOrder: 'asc' } },
};

function serializeDish(dish) {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    image: dish.image, // cover
    category: dish.category ?? null,
    categoryId: dish.categoryId,
    isAvailable: dish.isAvailable,
    availableDays: dish.availableDays ?? [],
    availableFrom: dish.availableFrom,
    availableUntil: dish.availableUntil,
    photos: (dish.photos ?? []).map((p) => ({ id: p.id, url: p.url, sortOrder: p.sortOrder })),
    createdAt: dish.createdAt,
    updatedAt: dish.updatedAt,
  };
}

// Ensures the dish exists and belongs to the authenticated cook.
async function ownDishOrThrow(cookId, dishId) {
  const dish = await prisma.dish.findUnique({ where: { id: dishId }, include: dishInclude });
  if (!dish || dish.cookId !== cookId) throw httpError(404, 'Страву не знайдено');
  return dish;
}

// Validate a category id exists (when provided). Returns null for empty.
async function resolveCategoryId(categoryId) {
  if (!categoryId) return null;
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw httpError(400, 'Категорію не знайдено');
  return cat.id;
}

// Normalises empty-string optionals coming from forms to null/undefined.
function cleanDishData(data) {
  const out = { ...data };
  if (out.description === '') out.description = null;
  if (out.availableFrom === '') out.availableFrom = null;
  if (out.availableUntil === '') out.availableUntil = null;
  return out;
}

// GET /api/cook/dishes — the cook's full menu (incl. unavailable).
export async function listMyDishes(req, res, next) {
  try {
    const dishes = await prisma.dish.findMany({
      where: { cookId: req.cook.id },
      include: dishInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ dishes: dishes.map(serializeDish), total: dishes.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/dishes — create a dish (requires an active/verified cook).
export async function createDish(req, res, next) {
  try {
    const data = createDishSchema.parse(req.body);
    const categoryId = await resolveCategoryId(data.categoryId);
    const clean = cleanDishData(data);

    const dish = await prisma.dish.create({
      data: {
        cookId: req.cook.id,
        name: clean.name,
        description: clean.description ?? null,
        price: clean.price,
        categoryId,
        isAvailable: clean.isAvailable ?? true,
        availableDays: clean.availableDays ?? [],
        availableFrom: clean.availableFrom ?? null,
        availableUntil: clean.availableUntil ?? null,
      },
      include: dishInclude,
    });
    res.status(201).json({ dish: serializeDish(dish) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/cook/dishes/:id — update an owned dish.
export async function updateDish(req, res, next) {
  try {
    await ownDishOrThrow(req.cook.id, req.params.id);
    const data = updateDishSchema.parse(req.body);
    const clean = cleanDishData(data);
    if ('categoryId' in clean) clean.categoryId = await resolveCategoryId(clean.categoryId);

    const dish = await prisma.dish.update({
      where: { id: req.params.id },
      data: clean,
      include: dishInclude,
    });
    res.json({ dish: serializeDish(dish) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cook/dishes/:id — remove an owned dish (+ its photo files).
export async function deleteDish(req, res, next) {
  try {
    const dish = await ownDishOrThrow(req.cook.id, req.params.id);
    await prisma.dish.delete({ where: { id: dish.id } });
    // Best-effort cleanup of stored files.
    for (const p of dish.photos ?? []) await deleteByUrl(p.url);
    if (dish.image) await deleteByUrl(dish.image);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/dishes/:id/photos — upload one or more photos (resized to webp).
export async function addDishPhotos(req, res, next) {
  try {
    const dish = await ownDishOrThrow(req.cook.id, req.params.id);
    const files = req.files ?? [];
    if (!files.length) throw httpError(400, 'Файли фото не надано');

    const existing = dish.photos?.length ?? 0;
    if (existing + files.length > MAX_PHOTOS) {
      throw httpError(400, `Максимум ${MAX_PHOTOS} фото на страву`);
    }

    let order = existing;
    const created = [];
    for (const file of files) {
      const url = await saveImage(file.buffer, 'dishes', { width: 1280, quality: 82 });
      const photo = await prisma.dishPhoto.create({
        data: { dishId: dish.id, url, sortOrder: order++ },
      });
      created.push(photo);
    }

    // Use the first uploaded photo as the cover if none set yet.
    if (!dish.image && created.length) {
      await prisma.dish.update({ where: { id: dish.id }, data: { image: created[0].url } });
    }

    const updated = await prisma.dish.findUnique({ where: { id: dish.id }, include: dishInclude });
    res.status(201).json({ dish: serializeDish(updated) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cook/dishes/:id/photos/:photoId — remove one photo.
export async function deleteDishPhoto(req, res, next) {
  try {
    const dish = await ownDishOrThrow(req.cook.id, req.params.id);
    const photo = dish.photos?.find((p) => p.id === req.params.photoId);
    if (!photo) throw httpError(404, 'Фото не знайдено');

    await prisma.dishPhoto.delete({ where: { id: photo.id } });
    await deleteByUrl(photo.url);

    // If we removed the cover, promote the next remaining photo (or clear it).
    if (dish.image === photo.url) {
      const next = dish.photos.find((p) => p.id !== photo.id);
      await prisma.dish.update({ where: { id: dish.id }, data: { image: next?.url ?? null } });
    }

    const updated = await prisma.dish.findUnique({ where: { id: dish.id }, include: dishInclude });
    res.json({ dish: serializeDish(updated) });
  } catch (err) {
    next(err);
  }
}

export { serializeDish };
