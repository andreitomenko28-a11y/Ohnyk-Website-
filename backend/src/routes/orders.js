import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { checkout, listMyOrders, getMyOrder } from '../controllers/orderController.js';

// Buyer-facing orders (checkout + history). Any authenticated user may buy.
const router = Router();

router.use(authGuard);

router.post('/', checkout);
router.get('/', listMyOrders);
router.get('/:id', getMyOrder);

export default router;
