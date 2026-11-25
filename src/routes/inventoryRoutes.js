/**
 * Inventory routes — view and manage a user's owned items.
 */
 
import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getUserInventory, deleteInventoryItem, useInventoryItem } from '../controllers/inventoryController.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

// GET /api/inventory/:userId              — all items owned by a user (self only)
inventoryRouter.get('/:userId', getUserInventory);

// POST /api/inventory/:userId/items/:itemId/use  — consume a relic to apply its effect (self only)
inventoryRouter.post('/:userId/items/:itemId/use', useInventoryItem);

// DELETE /api/inventory/:userId/items/:itemId  — remove an item from inventory (self only)
inventoryRouter.delete('/:userId/items/:itemId', deleteInventoryItem);

