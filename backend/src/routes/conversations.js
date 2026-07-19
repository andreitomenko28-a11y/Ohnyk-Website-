import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { listMessages, sendMessage, markRead } from '../controllers/chatController.js';

// In-app chat (Module 6.1). All routes are participant-guarded in the
// controller (buyer or the order's cook only).
const router = Router();

router.use(authGuard);

router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/read', markRead);

export default router;
