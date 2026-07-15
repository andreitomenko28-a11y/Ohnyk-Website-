import { Router } from 'express';
import { webhook } from '../controllers/paymentController.js';

// Payment provider callbacks. Unauthenticated (monobank calls it) but the
// handler verifies the X-Sign signature against the merchant public key.
const router = Router();

router.post('/webhook', webhook);

export default router;
