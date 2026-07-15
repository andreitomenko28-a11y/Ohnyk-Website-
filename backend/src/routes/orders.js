import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { checkout, listMyOrders, getMyOrder, deliverySlots } from '../controllers/orderController.js';
import { initPayment, getPaymentStatus, mockComplete } from '../controllers/paymentController.js';

// Buyer-facing orders (checkout + history). Any authenticated user may buy.
const router = Router();

router.use(authGuard);

router.get('/delivery-slots', deliverySlots);
router.post('/', checkout);
router.get('/', listMyOrders);
router.get('/:id', getMyOrder);

// Payment (Module 4.2) — MonoPay invoice + status. Mock is dev-only (stub mode).
router.post('/:id/pay', initPayment);
router.get('/:id/payment', getPaymentStatus);
router.post('/:id/pay/mock', mockComplete);

export default router;
