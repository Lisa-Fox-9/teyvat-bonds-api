/**
 * Quest controller — daily quests with XP, coins, and random item rewards.
 *
 * Quest types:
 *   - xp_only: awards XP to companion
 *   - coins: awards random 50–200 coins to user
 *   - random_item: awards random shop item (5% relic, 66% food, 29% weapon) + XP
 *
 * Daily reset:
 *   Completed quests are reset to 'active' if last_reset was on a previous calendar day.
 *
 * XP cap:
 *   Max level is 100 (requires 9,900 XP). XP is capped so level never exceeds 100.
 */

import { validationResult } from 'express-validator';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { assertOwnership } from '../middlewares/authMiddleware.js';
import {
  findAllQuests,
  findQuestsByUserId,
  findQuestById,
  insertQuest,
  updateQuest,
  removeQuest,
} from '../models/questModel.js';
import { findUserById, updateUser } from '../models/userModel.js';
import { findUserCharacterById, updateUserCharacter } from '../models/userCharacterModel.js';
import {
  findInventoryEntryByCategory,
  findInventoryEntry,
  insertInventoryEntry,
  updateInventoryQuantity,
  removeInventoryEntry,
} from '../models/inventoryModel.js';
import { findAllShopItems } from '../models/shopModel.js';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 100;
const MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL; // 9900

/**
 * Check if a quest needs daily reset (last_reset was before today).
 * @param {string} last_reset - ISO string
 * @returns {boolean}
 */
const needsDailyReset = (last_reset) => {
  const resetDate = new Date(last_reset).toDateString();
  const today = new Date().toDateString();
  return resetDate !== today;
};

/**
 * Pick a random shop item based on weighted category: 5% relic (ultra-rare,
 * rarer than any weapon), 66% food, 29% weapon (matching companion's
 * weapon_type).
 * @param {Array} allItems - full shop items array
 * @param {string} companionWeaponType - catalyst | polearm | sword
 * @returns {Object} a random shop item
 */
const pickRandomRewardItem = (allItems, companionWeaponType) => {
  const roll = Math.random() * 100;
  let category;
  if (roll < 5) category = 'relic';
  else if (roll < 71) category = 'food';
  else category = 'weapon';

  let pool;
  if (category === 'weapon') {
    // Only weapons matching the companion's weapon type
    pool = allItems.filter((i) => i.category === 'weapon' && i.weapon_type === companionWeaponType);
    // Fallback to food if no matching weapons found
    if (!pool.length) pool = allItems.filter((i) => i.category === 'food');
  } else {
    pool = allItems.filter((i) => i.category === category);
    // Relic pool could theoretically be empty — fall back to food rather than crash
    if (!pool.length) pool = allItems.filter((i) => i.category === 'food');
  }

  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * GET /api/quests?status=active
 * Returns all quests, optionally filtered by status. (completed | active | invalid)
 */
export const getAllQuests = async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && !['active', 'completed'].includes(status)) {
      throw new AppError('VALIDATION_ERROR', "status must be 'active' or 'completed'");
    }
    const result = await findAllQuests(db, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quests/:userId
 * Returns all quests for a user. Auto-resets completed daily quests if it's a new day.
 */
export const getQuestsByUser = async (req, res, next) => {
  try {
    const user = await findUserById(db, req.params.userId);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.userId}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const allQuests = await findQuestsByUserId(db, req.params.userId);

    // Auto-reset completed daily quests if last_reset was before today
    const resetPromises = allQuests
      .filter((q) => q.quest_type === 'daily' && q.status === 'completed' && needsDailyReset(q.last_reset))
      .map((q) => updateQuest(db, q.quest_id, { status: 'active', last_reset: new Date().toISOString() }));

    await Promise.all(resetPromises);

    // Return fresh list after reset
    const freshQuests = await findQuestsByUserId(db, req.params.userId);
    res.status(200).json(freshQuests);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/quests
 * Accept a new quest.
 */
export const acceptQuest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('VALIDATION_ERROR', errors.array()[0].msg);

    const user_id = req.user.user_id;
    const { quest_title, xp_reward, required_item_category, reward_type = 'xp_only' } = req.body;

    const user = await findUserById(db, user_id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${user_id}' not found`);

    if (required_item_category && !['food', 'weapon'].includes(required_item_category)) {
      throw new AppError('VALIDATION_ERROR', "required_item_category must be 'food', 'weapon', or omitted");
    }

    if (!['xp_only', 'coins', 'random_item'].includes(reward_type)) {
      throw new AppError('VALIDATION_ERROR', "reward_type must be 'xp_only', 'coins', or 'random_item'");
    }

    const quest_id = nanoid();
    await insertQuest(db, {
      quest_id,
      user_id,
      quest_title,
      quest_type: 'daily',
      status: 'active',
      xp_reward: Number(xp_reward),
      required_item_category: required_item_category || null,
      reward_type,
      last_reset: new Date().toISOString(),
    });

    res.status(201).json({
      quest_id,
      user_id,
      quest_title,
      status: 'active',
      xp_reward: Number(xp_reward),
      required_item_category: required_item_category || null,
      reward_type,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/quests/:id/complete
 * Complete a quest and apply its reward:
 *   - xp_only: XP to companion
 *   - coins: random 50–200 coins to user + XP to companion
 *   - random_item: random shop item to inventory + XP to companion (5% - relic (rare) | 66% - food/fruit | 29% - weapon)
 * Body: { user_character_id }
 */
export const completeQuest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('VALIDATION_ERROR', errors.array()[0].msg);

    const quest = await findQuestById(db, req.params.id);
    if (!quest) throw new AppError('NOT_FOUND', `Quest with id '${req.params.id}' not found`);
    assertOwnership(quest.user_id, req.user.user_id);
    if (quest.status === 'completed') throw new AppError('VALIDATION_ERROR', 'This quest is already completed');

    const { user_character_id } = req.body;
    const character = await findUserCharacterById(db, user_character_id);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${user_character_id}' not found`);

    // Verify the companion belongs to the same user as the quest
    if (character.user_id !== quest.user_id) {
      throw new AppError('VALIDATION_ERROR', 'This companion does not belong to the quest owner');
    }

    // Check required item
    if (quest.required_item_category) {
      const slot = await findInventoryEntryByCategory(db, quest.user_id, quest.required_item_category);
      if (!slot) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Missing required item: need a '${quest.required_item_category}' in your inventory to complete this quest`
        );
      }
      if (slot.quantity > 1) {
        await updateInventoryQuantity(db, slot.inventory_id, slot.quantity - 1);
      } else {
        await removeInventoryEntry(db, slot.inventory_id);
      }
    }

    // Award XP (capped at MAX_XP)
    const oldLevel = character.level;
    const newXp = Math.min(MAX_XP, character.xp + quest.xp_reward);
    const newLevel = Math.min(MAX_LEVEL, Math.floor(newXp / XP_PER_LEVEL) + 1);
    const leveledUp = newLevel > oldLevel;
    await updateUserCharacter(db, user_character_id, { xp: newXp, level: newLevel });

    // Mark quest completed
    await updateQuest(db, quest.quest_id, { status: 'completed', last_reset: new Date().toISOString() });

    const response = {
      message: 'Quest completed!',
      xp_awarded: quest.xp_reward,
      leveled_up: leveledUp,
      companion: { user_character_id, character_name: character.character_name, xp: newXp, level: newLevel },
    };

    // Apply reward type
    if (quest.reward_type === 'coins') {
      const coinsAwarded = Math.floor(Math.random() * 151) + 50; // 50–200
      const user = await findUserById(db, quest.user_id);
      await updateUser(db, quest.user_id, { coins: user.coins + coinsAwarded });
      response.coins_awarded = coinsAwarded;
      response.message = `Quest completed! You found ${coinsAwarded} coins from the Ley Line!`;
    }

    if (quest.reward_type === 'random_item') {
      const allItems = await findAllShopItems(db);
      const rewardItem = pickRandomRewardItem(allItems, character.weapon_type);

      if (rewardItem) {
        const existing = await findInventoryEntry(db, quest.user_id, rewardItem.item_id);
        if (existing) {
          await updateInventoryQuantity(db, existing.inventory_id, existing.quantity + 1);
        } else {
          await insertInventoryEntry(db, {
            inventory_id: nanoid(),
            user_id: quest.user_id,
            item_id: rewardItem.item_id,
            quantity: 1,
          });
        }
        response.item_awarded = { item_name: rewardItem.item_name, category: rewardItem.category };
        response.message = `Quest completed! The Blossom of Revelation revealed: ${rewardItem.item_name}!`;
      }
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/quests/:id
 * Abandon a quest.
 */
export const deleteQuest = async (req, res, next) => {
  try {
    const quest = await findQuestById(db, req.params.id);
    if (!quest) throw new AppError('NOT_FOUND', `Quest with id '${req.params.id}' not found`);
    assertOwnership(quest.user_id, req.user.user_id);

    await removeQuest(db, quest.quest_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};