import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { updateUserSchema } from '../validation/schemas.js';
import { publicUser } from './authController.js';

// GET /api/users/:id
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
    const { bio, ...userData } = data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...userData,
        // Cook bio lives on the related Cook record.
        ...(bio !== undefined && {
          cookProfile: { update: { bio } },
        }),
      },
      include: { cookProfile: true },
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
