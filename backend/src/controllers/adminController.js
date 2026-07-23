import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { normalizeDocUrl } from '../lib/storage.js';
import {
  adminRejectSchema,
  listUsersSchema,
  listAdminCooksSchema,
  blockUserSchema,
} from '../validation/schemas.js';
import { writeAdminLog } from '../lib/adminLog.js';
import { sendEmail } from '../lib/email.js';

// Shape a user row for the admin users table.
function adminUser(u) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isBlocked: u.isBlocked,
    blockReason: u.blockReason,
    blockedAt: u.blockedAt,
    createdAt: u.createdAt,
  };
}

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
    verificationDocUrl: normalizeDocUrl(cook.verificationDocUrl),
    identityDocUrl: normalizeDocUrl(cook.identityDocUrl),
    kitchenPhotoUrl: cook.kitchenPhotoUrl,
    kitchenVideoUrl: cook.kitchenVideoUrl,
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
    await writeAdminLog({ adminId: req.user.id, action: 'cook.verify', targetType: 'cook', targetId: cook.id });
    if (updated.user?.email) {
      sendEmail({
        to: updated.user.email,
        subject: 'Ohnyk — ваш профіль кухаря підтверджено',
        text: `Вітаємо, ${updated.user.fullName || ''}! Ваш профіль кухаря підтверджено — тепер ви можете приймати замовлення.`,
      }).catch(() => {});
    }
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
    await writeAdminLog({ adminId: req.user.id, action: 'cook.reject', targetType: 'cook', targetId: cook.id, meta: reason ? { reason } : undefined });
    if (updated.user?.email) {
      sendEmail({
        to: updated.user.email,
        subject: 'Ohnyk — заявку на верифікацію відхилено',
        text: `На жаль, вашу заявку на верифікацію відхилено${reason ? `: ${reason}` : ''}. Ви можете оновити дані та подати заявку знову.`,
      }).catch(() => {});
    }
    res.json({
      cook: adminCook(updated),
      message: reason ? `Заявку відхилено: ${reason}` : 'Заявку відхилено.',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users — paginated user list with filters (q / role / blocked).
export async function listUsers(req, res, next) {
  try {
    const { q, role, blocked, limit, offset } = listUsersSchema.parse(req.query);
    const where = {
      ...(role ? { role } : {}),
      ...(blocked !== undefined ? { isBlocked: blocked } : {}),
      ...(q
        ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
        : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.user.count({ where }),
    ]);
    res.json({ users: users.map(adminUser), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/cooks — paginated cook list with a verificationStatus filter.
export async function listCooks(req, res, next) {
  try {
    const { status, q, limit, offset } = listAdminCooksSchema.parse(req.query);
    const where = {
      ...(status ? { verificationStatus: status } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { user: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [cooks, total] = await Promise.all([
      prisma.cook.findMany({ where, include: adminInclude, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.cook.count({ where }),
    ]);
    res.json({ cooks: cooks.map(adminCook), total, limit, offset });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/users/:id/block — block a user (admins cannot block admins).
export async function blockUser(req, res, next) {
  try {
    const { reason } = blockUserSchema.parse(req.body ?? {});
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw httpError(404, 'Користувача не знайдено');
    if (target.id === req.user.id) throw httpError(400, 'Неможливо заблокувати самого себе');
    if (target.role === 'ADMIN') throw httpError(403, 'Неможливо заблокувати адміністратора');

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { isBlocked: true, blockReason: reason || null, blockedAt: new Date(), blockedByAdminId: req.user.id },
    });
    await writeAdminLog({ adminId: req.user.id, action: 'user.block', targetType: 'user', targetId: target.id, meta: reason ? { reason } : undefined });
    res.json({ user: adminUser(updated) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/users/:id/unblock — lift a block.
export async function unblockUser(req, res, next) {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw httpError(404, 'Користувача не знайдено');

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { isBlocked: false, blockReason: null, blockedAt: null, blockedByAdminId: null },
    });
    await writeAdminLog({ adminId: req.user.id, action: 'user.unblock', targetType: 'user', targetId: target.id });
    res.json({ user: adminUser(updated) });
  } catch (err) {
    next(err);
  }
}
