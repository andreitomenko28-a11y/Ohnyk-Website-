import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { updateUserSchema } from '../validation/schemas.js';
import { publicUser } from './authController.js';
import { publicCook } from './cookController.js';

// Splits validated body into User columns and Cook columns.
function splitProfileData(data) {
  const { bio, city, avatar, ...userData } = data;
  const cookData = {};
  if (bio !== undefined) cookData.bio = bio;
  if (city !== undefined) cookData.city = city;
  // `avatar` applies to both the user and (if present) the cook card.
  if (avatar !== undefined) userData.avatar = avatar;
  return { userData, cookData };
}

// Update a user's profile, nesting the cook-only fields (bio/city) only when
// the target actually has a Cook row. Without the existence check, a CUSTOMER
// sending `bio` or `city` triggered a nested update against a relation that
// isn't there and the whole request 500'd; those fields simply have nowhere to
// live for a non-cook, so they are dropped rather than crashing the update.
async function applyProfileUpdate(userId, data) {
  const { userData, cookData } = splitProfileData(data);

  let nestCook = false;
  if (Object.keys(cookData).length) {
    const cook = await prisma.cook.findUnique({ where: { userId }, select: { id: true } });
    nestCook = !!cook;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...userData,
      ...(nestCook ? { cookProfile: { update: cookData } } : {}),
    },
    include: { cookProfile: true, courierProfile: true },
  });
}

// GET /api/users/profile  (protected — current user)
export async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { cookProfile: true, courierProfile: true },
    });
    if (!user) throw httpError(404, 'Користувача не знайдено');
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/profile  (protected — current user)
export async function updateProfile(req, res, next) {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await applyProfileUpdate(req.user.id, data);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/favorites  (protected) — the current user's favourite cooks.
export async function listFavorites(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { favoriteCookIds: true },
    });
    const ids = user?.favoriteCookIds ?? [];
    const cooks = ids.length
      ? await prisma.cook.findMany({
          where: { id: { in: ids } },
          include: { user: { select: { fullName: true } }, dishes: { where: { isAvailable: true }, select: { price: true } } },
        })
      : [];
    res.json({ cooks: cooks.map(publicCook) });
  } catch (err) {
    next(err);
  }
}

// Favourites live in a String[] column, so reading the array, changing it in JS
// and writing the whole thing back loses one of two concurrent edits: both read
// the same array and the second write overwrites the first. Tapping the heart on
// two cooks quickly — or the same tap replayed on a flaky connection — kept only
// one. Each change is a single conditional statement instead, so Postgres
// serialises them on the row and both survive.
//
// `array_append` guarded by NOT (… = ANY(…)) keeps add idempotent: a repeat tap
// matches nothing and changes nothing, no read needed to decide.
function appendFavorite(userId, cookId) {
  return prisma.$executeRaw`
    UPDATE "User"
    SET "favoriteCookIds" = array_append("favoriteCookIds", ${cookId})
    WHERE "id" = ${userId} AND NOT (${cookId} = ANY("favoriteCookIds"))
  `;
}

function dropFavorite(userId, cookId) {
  return prisma.$executeRaw`
    UPDATE "User"
    SET "favoriteCookIds" = array_remove("favoriteCookIds", ${cookId})
    WHERE "id" = ${userId}
  `;
}

function loadUserWithProfiles(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { cookProfile: true, courierProfile: true },
  });
}

// PUT /api/users/favorites/:cookId  (protected) — add to favourites (idempotent).
export async function addFavorite(req, res, next) {
  try {
    const { cookId } = req.params;
    const cook = await prisma.cook.findUnique({ where: { id: cookId } });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');

    await appendFavorite(req.user.id, cookId);
    res.json({ user: publicUser(await loadUserWithProfiles(req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/favorites/:cookId  (protected) — remove from favourites.
export async function removeFavorite(req, res, next) {
  try {
    await dropFavorite(req.user.id, req.params.cookId);
    res.json({ user: publicUser(await loadUserWithProfiles(req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id  (protected — owner or admin only; exposes email/phone).
// Returns 404 (not 403) to others so ids can't be enumerated.
export async function getUser(req, res, next) {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
      throw httpError(404, 'Користувача не знайдено');
    }
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { cookProfile: true, courierProfile: true },
    });
    if (!user) throw httpError(404, 'Користувача не знайдено');
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id  (protected — only owner or admin)
export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      throw httpError(403, 'Можна редагувати лише власний профіль');
    }

    const data = updateUserSchema.parse(req.body);
    const user = await applyProfileUpdate(id, data);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
