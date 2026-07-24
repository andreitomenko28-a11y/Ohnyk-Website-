import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  passwordReset,
  passwordResetConfirm,
} from '../controllers/authController.js';
import { authGuard } from '../middleware/authGuard.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.get('/me', authGuard, me);
router.post('/password-reset', authLimiter, passwordReset);
router.post('/password-reset-confirm', authLimiter, passwordResetConfirm);

export default router;
