import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard.js';
import { loadCook } from '../middleware/cookGuard.js';
import { imageUpload, docUpload, handleUploadError } from '../lib/upload.js';
import {
  getMyCookProfile,
  updateMyCookProfile,
  uploadProfilePhoto,
  requestPhoneVerification,
  confirmPhoneVerification,
  uploadVerificationDocument,
} from '../controllers/cookAccountController.js';

// All routes here operate on the *authenticated* cook's own account.
// (Public discovery lives under /api/cooks — plural.)
const router = Router();

router.use(authGuard, requireRole('COOK'), loadCook);

router.get('/me', getMyCookProfile);
router.put('/profile', updateMyCookProfile);
router.post('/profile/photo', imageUpload.single('photo'), handleUploadError, uploadProfilePhoto);

// Phone verification (stub provider — see lib/sms.js).
router.post('/verification/phone/request', requestPhoneVerification);
router.post('/verification/phone/confirm', confirmPhoneVerification);

// Permit/document upload for manual admin review.
router.post(
  '/verification/document',
  docUpload.single('document'),
  handleUploadError,
  uploadVerificationDocument,
);

export default router;
