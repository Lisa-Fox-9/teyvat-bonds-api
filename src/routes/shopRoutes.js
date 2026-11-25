/**
 * Shop routes — browse items and make purchases.
 */
 
import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getAllShopItems, buyShopItem } from '../controllers/shopController.js';

export const shopRouter = Router();

// GET /api/shop                — all shop items (supports ?category= filter) — public browsing
shopRouter.get('/', getAllShopItems);

// POST /api/shop/buy           — purchase an item (deducts coins, adds to inventory)
shopRouter.post('/buy', requireAuth, [
  body('item_id').notEmpty().withMessage('item_id is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be a positive integer'),
], buyShopItem);

