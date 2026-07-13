import { prisma } from '../lib/prisma.js';
import { httpError } from './errorHandler.js';

// Loads the authenticated user's cook profile and attaches it as req.cook.
// Must run after authGuard + requireRole('COOK').
export async function loadCook(req, res, next) {
  try {
    const cook = await prisma.cook.findUnique({ where: { userId: req.user.id } });
    if (!cook) return next(httpError(404, 'Профіль кухаря не знайдено'));
    req.cook = cook;
    next();
  } catch (err) {
    next(err);
  }
}

// Requires the cook to be verified AND active. Use to gate menu publishing and
// order handling: a PENDING/REJECTED/SUSPENDED cook is blocked. Runs after
// loadCook (or loads the profile itself if not present).
export async function requireActiveCook(req, res, next) {
  try {
    const cook = req.cook ?? (await prisma.cook.findUnique({ where: { userId: req.user.id } }));
    if (!cook) return next(httpError(404, 'Профіль кухаря не знайдено'));
    req.cook = cook;

    if (cook.status === 'SUSPENDED') {
      return next(httpError(403, 'Ваш акаунт кухаря призупинено'));
    }
    if (cook.verificationStatus !== 'VERIFIED' || cook.status !== 'ACTIVE') {
      return next(
        httpError(
          403,
          'Акаунт кухаря ще не верифіковано. Публікація меню та отримання замовлень будуть доступні після підтвердження адміністратором.',
        ),
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}
