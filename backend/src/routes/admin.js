import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard.js';
import { listPendingCooks, verifyCook, rejectCook } from '../controllers/adminController.js';

// Admin-only endpoints (Phase 3: cook verification queue).
// A full admin UI arrives in Phase 7; these back the manual review flow now.
const router = Router();

router.use(authGuard, requireRole('ADMIN'));

router.get('/cooks/pending', listPendingCooks);
router.post('/cooks/:id/verify', verifyCook);
router.post('/cooks/:id/reject', rejectCook);

export default router;
