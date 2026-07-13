import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { adminRejectSchema } from '../validation/schemas.js';

// Shape a cook for the admin review queue.
function adminCook(cook) {
  return {
    id: cook.id,
    userId: cook.userId,
    displayName: cook.displayName,
    fullName: cook.user?.fullName,
    email: cook.user?.email,
    phone: cook.user?.phone,
    bio: cook.bio,
    avatar: cook.avatar,
    city: cook.city,
    kitchenAddress: cook.kitchenAddress,
    deliveryZone: cook.deliveryZone,
    isVerified: cook.isVerified,
    phoneVerified: cook.phoneVerified,
    verificationStatus: cook.verificationStatus,
    verificationDocUrl: cook.verificationDocUrl,
    status: cook.status,
    verifiedAt: cook.verifiedAt,
    createdAt: cook.createdAt,
  };
}

const adminInclude = { user: { select: { fullName: true, email: true, phone: true } } };

// GET /api/admin/cooks/pending  — cooks awaiting verification.
export async function listPendingCooks(req, res, next) {
  try {
    const cooks = await prisma.cook.findMany({
      where: { verificationStatus: 'PENDING' },
      include: adminInclude,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ cooks: cooks.map(adminCook), total: cooks.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/cooks/:id/verify  — approve a cook: activate + set badge.
export async function verifyCook(req, res, next) {
  try {
    const cook = await prisma.cook.findUnique({ where: { id: req.params.id }, include: adminInclude });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');
    if (cook.verificationStatus === 'VERIFIED') {
      throw httpError(409, 'Кухаря вже верифіковано');
    }
    const updated = await prisma.cook.update({
      where: { id: cook.id },
      data: {
        verificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        isVerified: true, // keep Phase 2 badge in sync
        verifiedAt: new Date(),
        verifiedByAdminId: req.user.id,
      },
      include: adminInclude,
    });
    res.json({ cook: adminCook(updated), message: 'Кухаря верифіковано та активовано.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/cooks/:id/reject  — decline verification.
export async function rejectCook(req, res, next) {
  try {
    const { reason } = adminRejectSchema.parse(req.body ?? {});
    const cook = await prisma.cook.findUnique({ where: { id: req.params.id }, include: adminInclude });
    if (!cook) throw httpError(404, 'Кухаря не знайдено');
    const updated = await prisma.cook.update({
      where: { id: cook.id },
      data: {
        verificationStatus: 'REJECTED',
        status: 'PENDING',
        isVerified: false,
      },
      include: adminInclude,
    });
    res.json({
      cook: adminCook(updated),
      message: reason ? `Заявку відхилено: ${reason}` : 'Заявку відхилено.',
    });
  } catch (err) {
    next(err);
  }
}
