import { Router } from 'express';
import {
  register,
  login,
  refresh,
  me,
  passwordReset,
  passwordResetConfirm,
} from '../controllers/authController.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authGuard, me);
router.post('/password-reset', passwordReset);
router.post('/password-reset-confirm', passwordResetConfirm);

export default router;
