import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { httpError } from './errorHandler.js';

// Requires a valid Bearer access token. Attaches { id, role } to req.user.
// Also enforces moderation: a blocked account (Phase 7.1) is rejected on every
// request, so a block takes effect immediately (not only on next login).
export async function authGuard(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(httpError(401, 'Потрібна авторизація'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(httpError(401, 'Недійсний або прострочений токен'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isBlocked: true },
    });
    if (!user) return next(httpError(401, 'Недійсний або прострочений токен'));
    if (user.isBlocked) return next(httpError(403, 'Ваш акаунт заблоковано'));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Restricts a route to specific roles. Use after authGuard.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, 'Недостатньо прав'));
    }
    next();
  };
}
