import { Router } from 'express';
import {
  getUser,
  updateUser,
  getProfile,
  updateProfile,
  listFavorites,
  addFavorite,
  removeFavorite,
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

// Favourite cooks.
router.get('/favorites', authGuard, listFavorites);
router.put('/favorites/:cookId', authGuard, addFavorite);
router.delete('/favorites/:cookId', authGuard, removeFavorite);

// Profile by id — owner/admin only (returns email/phone, so it must not be
// public). Cook *public* profiles are served separately via /api/cooks/:id.
router.get('/:id', authGuard, getUser);
router.patch('/:id', authGuard, updateUser);

export default router;
