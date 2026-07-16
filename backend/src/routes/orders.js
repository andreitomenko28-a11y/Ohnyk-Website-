import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { checkout, listMyOrders, getMyOrder, deliverySlots } from '../controllers/orderController.js';
import { initPayment, getPaymentStatus, mockComplete } from '../controllers/paymentController.js';
import { upsertReview, deleteReview } from '../controllers/reviewController.js';

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

// Reviews (Module 5.1) — verified purchase: one review per delivered order.
router.post('/:id/review', upsertReview);
router.delete('/:id/review', deleteReview);

export default router;
