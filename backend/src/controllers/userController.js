import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { updateUserSchema } from '../validation/schemas.js';
import { publicUser } from './authController.js';

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
      include: { cookProfile: true },
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
      include: { cookProfile: true },
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id  (public profile)
export async function getUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { cookProfile: true },
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
      include: { cookProfile: true },
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
