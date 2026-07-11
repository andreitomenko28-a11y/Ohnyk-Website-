import { Router } from 'express';
import {
  listAddresses,
  createAddress,
  deleteAddress,
} from '../controllers/addressController.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

// All address routes require authentication.
router.use(authGuard);

router.get('/', listAddresses);
router.post('/', createAddress);
router.delete('/:id', deleteAddress);

export default router;
