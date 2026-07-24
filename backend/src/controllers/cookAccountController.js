import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { saveImage, saveDocument, deleteByUrl, normalizeDocUrl } from '../lib/storage.js';
import { sendVerificationCode, checkVerificationCode } from '../lib/sms.js';
import {
  cookProfileUpdateSchema,
  phoneVerifyConfirmSchema,
} from '../validation/schemas.js';

// Full profile shape for the owner (includes verification internals).
function cookAccount(cook, user) {
  return {
    id: cook.id,
    displayName: cook.displayName,
    fullName: user?.fullName,
    phone: user?.phone,
    bio: cook.bio,
    avatar: cook.avatar,
    city: cook.city,
    kitchenAddress: cook.kitchenAddress,
    deliveryZone: cook.deliveryZone,
    rating: cook.rating,
    reviewCount: cook.reviewCount,
    isVerified: cook.isVerified,
    phoneVerified: cook.phoneVerified,
    verificationStatus: cook.verificationStatus,
    verificationDocUrl: normalizeDocUrl(cook.verificationDocUrl),
    identityDocUrl: normalizeDocUrl(cook.identityDocUrl),
    kitchenPhotoUrl: cook.kitchenPhotoUrl,
    kitchenVideoUrl: cook.kitchenVideoUrl,
    verifiedAt: cook.verifiedAt,
    status: cook.status,
    // Convenience flag for the client: may the cook publish menu / take orders?
    canOperate: cook.verificationStatus === 'VERIFIED' && cook.status === 'ACTIVE',
    createdAt: cook.createdAt,
    updatedAt: cook.updatedAt,
  };
}

async function withUser(cook) {
  const user = await prisma.user.findUnique({
    where: { id: cook.userId },
    select: { fullName: true, phone: true },
  });
  return cookAccount(cook, user);
}

// GET /api/cook/me
export async function getMyCookProfile(req, res, next) {
  try {
    res.json({ cook: await withUser(req.cook) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/cook/profile
export async function updateMyCookProfile(req, res, next) {
  try {
    const data = cookProfileUpdateSchema.parse(req.body);
    if (data.deliveryZone === '') data.deliveryZone = null;
    const cook = await prisma.cook.update({ where: { id: req.cook.id }, data });
    res.json({ cook: await withUser(cook) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/profile/photo  (multipart: field "photo")
export async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'Файл фото не надано');
    const url = await saveImage(req.file.buffer, 'cooks', { width: 512, quality: 82 });
    const prev = req.cook.avatar;
    const cook = await prisma.cook.update({ where: { id: req.cook.id }, data: { avatar: url } });
    if (prev) await deleteByUrl(prev);
    res.status(201).json({ cook: await withUser(cook) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/verification/phone/request  — issues a hashed, expiring code.
export async function requestPhoneVerification(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.phone) throw httpError(400, 'Спершу додайте номер телефону в профілі');
    const result = await sendVerificationCode(user.id, user.phone);
    res.json({
      message: 'Код підтвердження надіслано на ваш номер.',
      ...result, // includes devCode outside production
    });
  } catch (err) {
    next(err);
  }
}

// Maps a check failure reason to an HTTP status + message. A locked/expired
// challenge is a distinct, actionable state (re-request), not a plain 400.
function verificationError(reason) {
  switch (reason) {
    case 'locked':
      return httpError(429, 'Забагато невдалих спроб. Запитайте новий код.');
    case 'expired':
    case 'consumed':
    case 'no_code':
      return httpError(400, 'Код недійсний або застарілий. Запитайте новий код.');
    default: // 'mismatch'
      return httpError(400, 'Невірний код підтвердження');
  }
}

// POST /api/cook/verification/phone/confirm  — attempts are capped (see sms.js).
export async function confirmPhoneVerification(req, res, next) {
  try {
    const { code } = phoneVerifyConfirmSchema.parse(req.body);
    const { ok, reason } = await checkVerificationCode(req.user.id, code);
    if (!ok) throw verificationError(reason);
    const cook = await prisma.cook.update({
      where: { id: req.cook.id },
      data: { phoneVerified: true },
    });
    res.json({ cook: await withUser(cook), message: 'Телефон підтверджено.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/verification/document  (multipart: field "document")
// Stores the permit; automatic checking is not implemented — an admin reviews
// it manually (see adminController). Status stays PENDING.
export async function uploadVerificationDocument(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'Файл документа не надано');
    const url = await saveDocument(req.file.buffer, 'verification', req.file.originalname, { private: true });
    const prev = req.cook.verificationDocUrl;
    const cook = await prisma.cook.update({
      where: { id: req.cook.id },
      data: { verificationDocUrl: url },
    });
    if (prev) await deleteByUrl(prev);
    res.status(201).json({
      cook: await withUser(cook),
      message: 'Документ завантажено. Очікуйте на підтвердження адміністратором.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/verification/identity  (multipart: field "document")
// Passport / driver's licence for identity verification. Reviewed by an admin.
export async function uploadIdentityDocument(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'Файл документа не надано');
    const url = await saveDocument(req.file.buffer, 'identity', req.file.originalname, { private: true });
    const prev = req.cook.identityDocUrl;
    const cook = await prisma.cook.update({
      where: { id: req.cook.id },
      data: { identityDocUrl: url },
    });
    if (prev) await deleteByUrl(prev);
    res.status(201).json({
      cook: await withUser(cook),
      message: 'Документ особи завантажено. Очікуйте на підтвердження адміністратором.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/kitchen/photo  (multipart: field "photo") — optional, builds trust.
export async function uploadKitchenPhoto(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'Файл фото не надано');
    const url = await saveImage(req.file.buffer, 'kitchen', { width: 1280, quality: 82 });
    const prev = req.cook.kitchenPhotoUrl;
    const cook = await prisma.cook.update({
      where: { id: req.cook.id },
      data: { kitchenPhotoUrl: url },
    });
    if (prev) await deleteByUrl(prev);
    res.status(201).json({ cook: await withUser(cook) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cook/kitchen/video  (multipart: field "video") — optional, builds trust.
export async function uploadKitchenVideo(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'Файл відео не надано');
    const url = await saveDocument(req.file.buffer, 'kitchen', req.file.originalname);
    const prev = req.cook.kitchenVideoUrl;
    const cook = await prisma.cook.update({
      where: { id: req.cook.id },
      data: { kitchenVideoUrl: url },
    });
    if (prev) await deleteByUrl(prev);
    res.status(201).json({ cook: await withUser(cook) });
  } catch (err) {
    next(err);
  }
}

export { cookAccount };
