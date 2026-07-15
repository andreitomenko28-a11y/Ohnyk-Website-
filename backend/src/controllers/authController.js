import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { httpError } from '../middleware/errorHandler.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  passwordResetSchema,
  passwordResetConfirmSchema,
} from '../validation/schemas.js';

const SALT_ROUNDS = 10;
const RESET_TTL_MS = 1000 * 60 * 30; // 30 minutes

// Shape the user object we expose to clients (never leak passwordHash).
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    fullName: user.fullName,
    avatar: user.avatar ?? null,
    favoriteCookIds: user.favoriteCookIds ?? [],
    createdAt: user.createdAt,
    cook: user.cookProfile
      ? {
          id: user.cookProfile.id,
          displayName: user.cookProfile.displayName,
          bio: user.cookProfile.bio,
          avatar: user.cookProfile.avatar,
          isVerified: user.cookProfile.isVerified,
          rating: user.cookProfile.rating,
          reviewCount: user.cookProfile.reviewCount,
          city: user.cookProfile.city,
          kitchenAddress: user.cookProfile.kitchenAddress,
          deliveryZone: user.cookProfile.deliveryZone,
          phoneVerified: user.cookProfile.phoneVerified,
          verificationStatus: user.cookProfile.verificationStatus,
          verificationDocUrl: user.cookProfile.verificationDocUrl,
          identityDocUrl: user.cookProfile.identityDocUrl,
          kitchenPhotoUrl: user.cookProfile.kitchenPhotoUrl,
          kitchenVideoUrl: user.cookProfile.kitchenVideoUrl,
          verifiedAt: user.cookProfile.verifiedAt,
          status: user.cookProfile.status,
        }
      : null,
    courier: user.courierProfile
      ? {
          id: user.courierProfile.id,
          status: user.courierProfile.status,
          transport: user.courierProfile.transport,
        }
      : null,
    // Back-compat flat fields (Phase 1 clients).
    isVerified: user.cookProfile?.isVerified ?? undefined,
    bio: user.cookProfile?.bio ?? undefined,
  };
}

function issueTokens(user) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
        // Automatically create a cook profile for cooks, seeding onboarding
        // fields from the registration form. Verification stays PENDING.
        ...(data.role === 'COOK' && {
          cookProfile: {
            create: {
              displayName: data.displayName ?? data.fullName,
              bio: data.bio,
              kitchenAddress: data.kitchenAddress ?? '',
              deliveryZone: data.deliveryZone,
            },
          },
        }),
        // Couriers get an (offline) profile so they can go online right away.
        ...(data.role === 'COURIER' && {
          courierProfile: {
            create: { transport: data.transport ?? null, status: 'OFFLINE' },
          },
        }),
      },
      include: { cookProfile: true, courierProfile: true },
    });

    const tokens = issueTokens(user);
    res.status(201).json({ user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login  — identifier may be email or phone.
export async function login(req, res, next) {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const isEmail = identifier.includes('@');

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
      include: { cookProfile: true, courierProfile: true },
    });

    // Same generic message whether user is missing or password is wrong.
    if (!user) throw httpError(401, 'Невірний email/телефон або пароль');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw httpError(401, 'Невірний email/телефон або пароль');

    const tokens = issueTokens(user);
    res.json({ user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw httpError(401, 'Недійсний refresh-токен');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { cookProfile: true, courierProfile: true },
    });
    if (!user) throw httpError(401, 'Користувача не знайдено');

    const tokens = issueTokens(user);
    res.json({ user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (protected)
export async function me(req, res, next) {
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

// POST /api/auth/password-reset
// Always responds 200 (never reveals whether the email exists). In a real
// deployment the token is emailed; here we return it in the response so the
// flow is testable end-to-end without a mail provider.
export async function passwordReset(req, res, next) {
  try {
    const { email } = passwordResetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    let devToken;
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);
      // One active token per user: clear any previous ones first.
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });
      devToken = token;
    }

    res.json({
      message: 'Якщо такий акаунт існує, ми надіслали інструкції для скидання пароля.',
      // Exposed only outside production so the reset can be completed in dev/tests.
      ...(process.env.NODE_ENV !== 'production' && devToken ? { token: devToken } : {}),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/password-reset-confirm
export async function passwordResetConfirm(req, res, next) {
  try {
    const { token, password } = passwordResetConfirmSchema.parse(req.body);

    const record = await prisma.passwordReset.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw httpError(400, 'Недійсний або прострочений код скидання');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.deleteMany({ where: { userId: record.userId } }),
    ]);

    res.json({ message: 'Пароль успішно змінено. Тепер можна увійти.' });
  } catch (err) {
    next(err);
  }
}

export { publicUser };
