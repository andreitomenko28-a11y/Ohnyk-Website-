import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { httpError } from './errorHandler.js';

// Requires a valid Bearer access token. Attaches { id, role } to req.user.
//
// Both the block flag AND the role come from the database, never from the
// token. The token is only proof of who is calling; what they are allowed to do
// can change after it was issued, and an access token lives 15 minutes. Trusting
// the token's `role` meant an admin whose privileges were revoked kept them for
// the rest of that window.
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
      select: { isBlocked: true, role: true },
    });
    if (!user) return next(httpError(401, 'Недійсний або прострочений токен'));
    if (user.isBlocked) return next(httpError(403, 'Ваш акаунт заблоковано'));
    req.user = { id: payload.sub, role: user.role };
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
