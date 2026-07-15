import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  cartTotal,
} from '../controllers/cartController.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

// The cart always belongs to the authenticated user.
router.use(authGuard);

router.get('/', getCart);
router.post('/add', addToCart);
router.post('/total', cartTotal);
router.delete('/', clearCart);
router.patch('/:itemId', updateCartItem);
router.delete('/:itemId', removeCartItem);

export default router;
