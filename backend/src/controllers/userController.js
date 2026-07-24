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
    const { userData, cookData } = splitProfileData(data);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...userData,
        ...(Object.keys(cookData).length && {
          cookProfile: { update: cookData },
        }),
      },
      include: { cookProfile: true, courierProfile: true },
    });

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

// PUT /api/users/favorites/:cookId  (protected) — add to favourites (idempotent).
export async function addFavorite(req, res, next) {
  try {
    const { cookId } = req.params;
    const cook = await prisma.cook.findUnique({ where: { id: cookId } });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { cookProfile: true, courierProfile: true },
    });
    if (!user.favoriteCookIds.includes(cookId)) {
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { favoriteCookIds: { set: [...user.favoriteCookIds, cookId] } },
        include: { cookProfile: true, courierProfile: true },
      });
      return res.json({ user: publicUser(updated) });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/favorites/:cookId  (protected) — remove from favourites.
export async function removeFavorite(req, res, next) {
  try {
    const { cookId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { cookProfile: true, courierProfile: true },
    });
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { favoriteCookIds: { set: user.favoriteCookIds.filter((id) => id !== cookId) } },
      include: { cookProfile: true, courierProfile: true },
    });
    res.json({ user: publicUser(updated) });
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
    const { userData, cookData } = splitProfileData(data);

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(Object.keys(cookData).length && {
          cookProfile: { update: cookData },
        }),
      },
      include: { cookProfile: true, courierProfile: true },
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
