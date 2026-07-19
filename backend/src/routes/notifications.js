import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import {
  listNotifications,
  markAllRead,
  markRead,
  linkTelegram,
  unlinkTelegram,
  telegramStatus,
  telegramWebhook,
} from '../controllers/notificationController.js';

const router = Router();

// Telegram Bot API callback — unauthenticated (verified by /start token).
router.post('/telegram/webhook', telegramWebhook);

// Everything else is the current user's own notification centre.
router.use(authGuard);

router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);

router.get('/telegram/status', telegramStatus);
router.post('/telegram/link', linkTelegram);
router.delete('/telegram', unlinkTelegram);

export default router;
