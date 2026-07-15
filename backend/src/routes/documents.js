import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { getDocument } from '../controllers/documentController.js';

// Private document access (identity / verification PII). Authenticated only;
// the controller further restricts to the owning cook or an admin.
const router = Router();

router.use(authGuard);
router.get('/:folder/:name', getDocument);

export default router;
