import { Router } from 'express';
import {
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from '../controllers/addressController.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

// All address routes require authentication.
router.use(authGuard);

router.get('/', listAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.put('/:id/default', setDefaultAddress);
router.delete('/:id', deleteAddress);

export default router;
