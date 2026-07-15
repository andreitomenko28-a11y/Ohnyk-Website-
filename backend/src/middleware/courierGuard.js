import { prisma } from '../lib/prisma.js';
import { httpError } from './errorHandler.js';

// Loads the authenticated user's courier profile and attaches it as
// req.courier. Must run after authGuard + requireRole('COURIER').
export async function loadCourier(req, res, next) {
  try {
    const courier = await prisma.courierProfile.findUnique({ where: { userId: req.user.id } });
    if (!courier) return next(httpError(404, 'Профіль кур’єра не знайдено'));
    req.courier = courier;
    next();
  } catch (err) {
    next(err);
  }
}
