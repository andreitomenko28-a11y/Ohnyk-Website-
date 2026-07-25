import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard.js';
import { loadCourier } from '../middleware/courierGuard.js';
import {
  getMe,
  updateStatus,
  listAvailable,
  listMine,
  claimOrder,
  advanceStatus,
  reportLocation,
} from '../controllers/courierController.js';
import { locationLimiter } from '../middleware/rateLimit.js';

// All routes operate on the *authenticated* courier's own account.
const router = Router();

router.use(authGuard, requireRole('COURIER'), loadCourier);

router.get('/me', getMe);
router.patch('/status', updateStatus);

router.get('/orders/available', listAvailable);
router.get('/orders', listMine);
router.post('/orders/:id/claim', claimOrder);
router.patch('/orders/:id/status', advanceStatus);

// Background location reporting (Phase 8.5). Rate-limited per courier rather
// than per IP — couriers on mobile data share carrier-NAT addresses.
router.post('/location', locationLimiter, reportLocation);

export default router;
