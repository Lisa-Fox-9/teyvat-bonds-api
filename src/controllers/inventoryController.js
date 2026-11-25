/**
 * Inventory controller — view and manage a user's owned items.
 */

import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { assertOwnership } from '../middlewares/authMiddleware.js';
import { findInventoryByUserId, findInventoryEntry, removeInventoryEntry, updateInventoryQuantity } from '../models/inventoryModel.js';
import { findUserById } from '../models/userModel.js';
import { findShopItemById } from '../models/shopModel.js';
import { findUserCharacterByUserId, updateUserCharacter } from '../models/userCharacterModel.js';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 100;
const MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL;

/**
 * GET /api/inventory/:userId
 * Returns all items in a user's inventory with full item details.
 */
export const getUserInventory = async (req, res, next) => {
  try {
    const user = await findUserById(db, req.params.userId);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.userId}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const inventory = await findInventoryByUserId(db, req.params.userId);
    res.status(200).json(inventory);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/inventory/:userId/items/:itemId
 * Removes an item entirely from a user's inventory.
 */
export const deleteInventoryItem = async (req, res, next) => {
  try {
    const { userId, itemId } = req.params;

    const user = await findUserById(db, userId);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${userId}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const entry = await findInventoryEntry(db, userId, itemId);
    if (!entry) throw new AppError('NOT_FOUND', `Item '${itemId}' not found in this user's inventory`);

    await removeInventoryEntry(db, entry.inventory_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inventory/:userId/items/:itemId/use
 * Consumes a relic item to apply its effect to the user's companion:
 *   - happiness_rescue: only usable while the companion is unhealthy (0 happiness) —
 *     the one recovery path feed/play cannot do. Restores happiness by effect_value.
 *   - level_boost: grants effect_value extra levels, implemented as bonus XP
 *     (effect_value * XP_PER_LEVEL) rather than setting `level` directly, so it stays
 *     consistent with how every other system (quests, duels) derives level from xp —
 *     directly overwriting `level` would get silently reverted the next time XP changes.
 * Non-effect items (food, weapons) are rejected — those are used through their own
 * flows (feeding, equipping), not this generic endpoint.
 */
export const useInventoryItem = async (req, res, next) => {
  try {
    const { userId, itemId } = req.params;

    const user = await findUserById(db, userId);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${userId}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const entry = await findInventoryEntry(db, userId, itemId);
    if (!entry) throw new AppError('NOT_FOUND', `Item '${itemId}' not found in this user's inventory`);

    const item = await findShopItemById(db, itemId);
    if (!item || !item.effect_type) {
      throw new AppError('VALIDATION_ERROR', `${item?.item_name || 'This item'} has no usable effect`);
    }

    const character = await findUserCharacterByUserId(db, userId);
    if (!character) throw new AppError('NOT_FOUND', 'You need a companion to use this item on');

    let message;
    let responsePayload = {};

    if (item.effect_type === 'happiness_rescue') {
      if (character.is_healthy) {
        throw new AppError('VALIDATION_ERROR', `${character.character_name} is already healthy — ${item.item_name} can only rescue an unhealthy companion`);
      }
      const newHappiness = Math.min(100, item.effect_value);
      await updateUserCharacter(db, character.user_character_id, {
        happiness_at_save: newHappiness,
        last_interaction: new Date().toISOString(),
        is_healthy: true,
      });
      message = `${item.item_name} rescued ${character.character_name}! Happiness restored to ${newHappiness}.`;
      responsePayload = { current_happiness: newHappiness, is_healthy: true };
    } else if (item.effect_type === 'level_boost') {
      const bonusXp = item.effect_value * XP_PER_LEVEL;
      const newXp = Math.min(MAX_XP, character.xp + bonusXp);
      const newLevel = Math.min(MAX_LEVEL, Math.floor(newXp / XP_PER_LEVEL) + 1);
      await updateUserCharacter(db, character.user_character_id, { xp: newXp, level: newLevel });
      message = `${item.item_name} surged through ${character.character_name} — now level ${newLevel}!`;
      responsePayload = { level: newLevel, xp: newXp };
    } else {
      throw new AppError('VALIDATION_ERROR', `Unknown effect type for ${item.item_name}`);
    }

    // Consume one unit of the item
    if (entry.quantity > 1) {
      await updateInventoryQuantity(db, entry.inventory_id, entry.quantity - 1);
    } else {
      await removeInventoryEntry(db, entry.inventory_id);
    }

    res.status(200).json({ message, ...responsePayload });
  } catch (error) {
    next(error);
  }
};