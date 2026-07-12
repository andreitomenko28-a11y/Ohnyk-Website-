import { Router } from 'express';
import {
  getUser,
  updateUser,
  getProfile,
  updateProfile,
} from '../controllers/userController.js';
import { authGuard } from '../middleware/authGuard.js';
import addressRoutes from './addresses.js';

const router = Router();

// Nested address management: /api/users/addresses/*
// Declared before "/:id" so "addresses" isn't captured as a user id.
router.use('/addresses', addressRoutes);

// Current user's own profile.
router.get('/profile', authGuard, getProfile);
router.patch('/profile', authGuard, updateProfile);

// Public profile by id + owner/admin edit.
router.get('/:id', getUser);
router.patch('/:id', authGuard, updateUser);

export default router;
