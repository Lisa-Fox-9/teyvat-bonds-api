/**
 * Shop controller — browse and purchase items.
 * Weapon purchases are validated against the user's companion weapon type.
 * Purchasing deducts coins from the user and adds item to inventory.
 */

import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { findAllShopItems, findShopItemById } from '../models/shopModel.js';
import { findUserById, updateUser } from '../models/userModel.js';
import { findInventoryEntry, insertInventoryEntry, updateInventoryQuantity } from '../models/inventoryModel.js';
import { findUserCharacterByUserId } from '../models/userCharacterModel.js';

/**
 * GET /api/shop
 * GET /api/shop?category=food
 * Returns all shop items, optionally filtered by category. (food | weapon | outfit)
 */
export const getAllShopItems = async (req, res, next) => {
  try {
    const { category } = req.query;
    const validCategories = ['food', 'weapon', 'outfit'];
    if (category && !validCategories.includes(category)) {
      throw new AppError('VALIDATION_ERROR', `category must be one of: ${validCategories.join(', ')}`);
    }
    const result = await findAllShopItems(db, category);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shop/buy
 * Purchase an item.
 * - Deducts coins from user.
 * - For weapons: validates weapon_type matches user's companion weapon_type.
 * - Adds item to inventory (stacks if already owned).
 */
export const buyShopItem = async (req, res, next) => {
  try {
    const user_id = req.user.user_id;
    const { item_id, quantity = 1 } = req.body;
    if (!item_id)
      throw new AppError('VALIDATION_ERROR', 'item_id is required');

    const qty = Number(quantity);

    const user = await findUserById(db, user_id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${user_id}' not found`);

    const item = await findShopItemById(db, item_id);
    if (!item) throw new AppError('NOT_FOUND', `Item with id '${item_id}' not found in shop`);

    // Weapon type validation — check against companion's weapon_type
    if (item.category === 'weapon') {
      const companion = await findUserCharacterByUserId(db, user_id);
      if (!companion) {
        throw new AppError('VALIDATION_ERROR', 'You need to adopt a companion before buying a weapon');
      }
      if (item.weapon_type !== companion.weapon_type) {
        throw new AppError(
          'VALIDATION_ERROR',
          `${companion.character_name} uses a ${companion.weapon_type}. This weapon is a ${item.weapon_type} and cannot be equipped`
        );
      }
    }

    // Check enough coins
    const totalCost = item.cost * qty;
    if (user.coins < totalCost) {
      throw new AppError('VALIDATION_ERROR', `Not enough coins. Need ${totalCost} coins but you only have ${user.coins}`);
    }

    // Deduct coins
    await updateUser(db, user_id, { coins: user.coins - totalCost });

    // Add to inventory (stack if already owned)
    const existing = await findInventoryEntry(db, user_id, item_id);
    if (existing) {
      await updateInventoryQuantity(db, existing.inventory_id, existing.quantity + qty);
    } else {
      await insertInventoryEntry(db, { inventory_id: nanoid(), user_id, item_id, quantity: qty });
    }

    res.status(201).json({
      message: `Purchased ${qty}x ${item.item_name} for ${totalCost} coins`,
      coins_remaining: user.coins - totalCost,
      item,
    });
  } catch (error) {
    next(error);
  }
};