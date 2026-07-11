import { verifyAccessToken } from '../lib/jwt.js';
import { httpError } from './errorHandler.js';

// Requires a valid Bearer access token. Attaches { id, role } to req.user.
export function authGuard(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(httpError(401, 'Потрібна авторизація'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(httpError(401, 'Недійсний або прострочений токен'));
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
