import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { httpError } from '../middleware/errorHandler.js';
import { registerSchema, loginSchema, refreshSchema } from '../validation/schemas.js';

const SALT_ROUNDS = 10;

// Shape the user object we expose to clients (never leak passwordHash).
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    fullName: user.fullName,
    createdAt: user.createdAt,
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
        // Automatically create a cook profile for cooks.
        ...(data.role === 'COOK' && { cookProfile: { create: {} } }),
      },
      include: { cookProfile: true },
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
      include: { cookProfile: true },
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
      include: { cookProfile: true },
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
      include: { cookProfile: true },
    });
    if (!user) throw httpError(404, 'Користувача не знайдено');
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export { publicUser };
