import { Router } from 'express';
import {
  listCooks,
  searchCooks,
  filterCooks,
  getCook,
  listCookDishes,
  getCookMenu,
} from '../controllers/cookController.js';

const router = Router();

// Static sub-paths must be declared before the dynamic "/:id".
router.get('/', listCooks);
router.get('/search', searchCooks);
router.get('/filter', filterCooks);
router.get('/:cookId/menu', getCookMenu);
router.get('/:cookId/dishes', listCookDishes);
router.get('/:id', getCook);

export default router;
