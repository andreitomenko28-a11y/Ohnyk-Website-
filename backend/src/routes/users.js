import { Router } from 'express';
import { getUser, updateUser } from '../controllers/userController.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

router.get('/:id', getUser);
router.patch('/:id', authGuard, updateUser);

export default router;
