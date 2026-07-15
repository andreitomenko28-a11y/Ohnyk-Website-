import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard.js';
import { loadCook, requireActiveCook } from '../middleware/cookGuard.js';
import { imageUpload, docUpload, videoUpload, handleUploadError, verifyFileSignature } from '../lib/upload.js';
import {
  getMyCookProfile,
  updateMyCookProfile,
  uploadProfilePhoto,
  requestPhoneVerification,
  confirmPhoneVerification,
  uploadVerificationDocument,
  uploadIdentityDocument,
  uploadKitchenPhoto,
  uploadKitchenVideo,
} from '../controllers/cookAccountController.js';
import {
  listMyDishes,
  createDish,
  updateDish,
  deleteDish,
  addDishPhotos,
  deleteDishPhoto,
} from '../controllers/cookMenuController.js';
import {
  listCookOrders,
  getCookOrder,
  updateOrderStatus,
  cookStats,
} from '../controllers/cookOrdersController.js';

// All routes here operate on the *authenticated* cook's own account.
// (Public discovery lives under /api/cooks — plural.)
const router = Router();

router.use(authGuard, requireRole('COOK'), loadCook);

router.get('/me', getMyCookProfile);
router.put('/profile', updateMyCookProfile);
router.post('/profile/photo', imageUpload.single('photo'), handleUploadError, verifyFileSignature, uploadProfilePhoto);

// Phone verification (stub provider — see lib/sms.js).
router.post('/verification/phone/request', requestPhoneVerification);
router.post('/verification/phone/confirm', confirmPhoneVerification);

// Document upload for manual admin review — personal medical record.
router.post(
  '/verification/document',
  docUpload.single('document'),
  handleUploadError,
  verifyFileSignature,
  uploadVerificationDocument,
);

// Identity document (passport / driver's licence) for identity verification.
router.post(
  '/verification/identity',
  docUpload.single('document'),
  handleUploadError,
  verifyFileSignature,
  uploadIdentityDocument,
);

// Optional kitchen photo & video — build buyer trust.
router.post('/kitchen/photo', imageUpload.single('photo'), handleUploadError, verifyFileSignature, uploadKitchenPhoto);
router.post('/kitchen/video', videoUpload.single('video'), handleUploadError, verifyFileSignature, uploadKitchenVideo);

// --- Menu management (Module 3.2) ------------------------------------------
// Viewing the own menu is allowed while pending; publishing/editing requires a
// verified + active cook (requireActiveCook gate).
router.get('/dishes', listMyDishes);
router.post('/dishes', requireActiveCook, createDish);
router.put('/dishes/:id', requireActiveCook, updateDish);
router.delete('/dishes/:id', requireActiveCook, deleteDish);
router.post(
  '/dishes/:id/photos',
  requireActiveCook,
  imageUpload.array('photos', 8),
  handleUploadError,
  verifyFileSignature,
  addDishPhotos,
);
router.delete('/dishes/:id/photos/:photoId', requireActiveCook, deleteDishPhoto);

// --- Dashboard: incoming orders + stats (Module 3.3) -----------------------
router.get('/orders', requireActiveCook, listCookOrders);
router.get('/stats', requireActiveCook, cookStats);
router.get('/orders/:id', requireActiveCook, getCookOrder);
router.patch('/orders/:id/status', requireActiveCook, updateOrderStatus);

export default router;
