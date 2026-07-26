import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard.js';
import {
  listPendingCooks,
  verifyCook,
  rejectCook,
  listUsers,
  listCooks,
  blockUser,
  unblockUser,
  listRefunds,
  markRefundComplete,
} from '../controllers/adminController.js';
import { adminAnalytics } from '../controllers/analyticsController.js';

// Admin-only endpoints. Cook verification queue (Phase 3) + user/cook
// moderation (Phase 7.1). The ADMIN role guard applies to the whole router.
const router = Router();

router.use(authGuard, requireRole('ADMIN'));

// Cook verification (Phase 3 — unchanged; email + audit log added internally).
router.get('/cooks/pending', listPendingCooks);
router.post('/cooks/:id/verify', verifyCook);
router.post('/cooks/:id/reject', rejectCook);

// Moderation (Phase 7.1).
router.get('/users', listUsers);
router.get('/cooks', listCooks);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/unblock', unblockUser);

// Analytics (Phase 7.2).
router.get('/analytics', adminAnalytics);

// Manual refunds: a cancelled paid order owes the buyer money back.
router.get('/refunds', listRefunds);
router.post('/refunds/:paymentId/complete', markRefundComplete);

export default router;
