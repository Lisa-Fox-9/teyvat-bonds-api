/**
 * User character controller — adopt, feed, play and manage a user's companion.
 *
 * Happiness decay:
 *   current_happiness = happiness_at_save - (minutes_elapsed × DRAIN_RATE)
 *   DRAIN_RATE = 5 per minute, min 0, max 100.
 *
 * Level-up:
 *   level = Math.floor(xp / 100) + 1, capped at level 100.
 *
 * On adoption:
 *   5 daily quests are automatically created for the user.
 */

import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { assertOwnership } from '../middlewares/authMiddleware.js';
import {
  findUserCharacterByUserId,
  findUserCharacterById,
  findExistingAdoption,
  insertUserCharacter,
  updateUserCharacter,
  removeUserCharacter,
} from '../models/userCharacterModel.js';
import { findRosterCharacterById } from '../models/rosterModel.js';
import { findUserById } from '../models/userModel.js';
import { insertQuest, findQuestsByUserId, removeQuest } from '../models/questModel.js';
import { removeDuelsByUserCharacterId } from '../models/duelModel.js';
import { findInventoryEntryByCategory, updateInventoryQuantity, removeInventoryEntry } from '../models/inventoryModel.js';

const DRAIN_RATE = 5;

/**
 * The 5 default daily quests auto-generated when a user adopts a companion.
 * @param {string} user_id
 * @returns {Array}
 */
const buildDefaultDailyQuests = (user_id) => {
  const now = new Date().toISOString();
  return [
    {
      quest_id: nanoid(),
      user_id,
      quest_title: 'Gathering Fruit',
      quest_type: 'daily',
      status: 'active',
      xp_reward: 50,
      required_item_category: 'food',
      reward_type: 'xp_only',
      last_reset: now,
    },
    {
      quest_id: nanoid(),
      user_id,
      quest_title: 'Submit a Meal',
      quest_type: 'daily',
      status: 'active',
      xp_reward: 50,
      required_item_category: 'food',
      reward_type: 'xp_only',
      last_reset: now,
    },
    {
      quest_id: nanoid(),
      user_id,
      quest_title: 'Explore the Wild',
      quest_type: 'daily',
      status: 'active',
      xp_reward: 50,
      required_item_category: null,
      reward_type: 'xp_only',
      last_reset: now,
    },
    {
      quest_id: nanoid(),
      user_id,
      quest_title: 'Defeat Ley Line: Blossom of Wealth',
      quest_type: 'daily',
      status: 'active',
      xp_reward: 20,
      required_item_category: null,
      reward_type: 'coins',
      last_reset: now,
    },
    {
      quest_id: nanoid(),
      user_id,
      quest_title: 'Defeat Ley Line: Blossom of Revelation',
      quest_type: 'daily',
      status: 'active',
      xp_reward: 100,
      required_item_category: 'weapon',
      reward_type: 'random_item',
      last_reset: now,
    },
  ];
};

/**
 * Calculate current happiness based on saved snapshot and elapsed time.
 * @param {number} happiness_at_save
 * @param {string} last_interaction - ISO string
 * @returns {number} 0–100
 */
const calcCurrentHappiness = (happiness_at_save, last_interaction) => {
  const minutesElapsed = Math.floor((Date.now() - new Date(last_interaction).getTime()) / 60000);
  return Math.max(0, happiness_at_save - minutesElapsed * DRAIN_RATE);
};

/**
 * Attach current_happiness to a user character object.
 */
const withCurrentHappiness = (uc) => ({
  ...uc,
  current_happiness: calcCurrentHappiness(uc.happiness_at_save, uc.last_interaction),
});

/**
 * GET /api/user-characters/:userId
 * Returns the user's adopted companion with current_happiness.
 */
export const getUserCharacter = async (req, res, next) => {
  try {
    const user = await findUserById(db, req.params.userId);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.userId}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const character = await findUserCharacterByUserId(db, req.params.userId);
    if (!character) throw new AppError('NOT_FOUND', `User '${req.params.userId}' has not adopted a companion yet`);

    const current_happiness = calcCurrentHappiness(character.happiness_at_save, character.last_interaction);

    // Auto-update is_healthy if happiness has decayed to 0
    if (current_happiness === 0 && character.is_healthy) {
      await updateUserCharacter(db, character.user_character_id, { is_healthy: false });
      character.is_healthy = false;
    }

    res.status(200).json({ ...character, current_happiness });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/roster/:id/adopt
 * User adopts a character from the roster.
 * A user can only have one companion at a time.
 * Automatically creates 5 default daily quests for the user.
 */
export const adoptCharacter = async (req, res, next) => {
  try {
    const user_id = req.user.user_id;

    const user = await findUserById(db, user_id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${user_id}' not found`);

    const rosterCharacter = await findRosterCharacterById(db, req.params.id);
    if (!rosterCharacter) throw new AppError('NOT_FOUND', `Roster character with id '${req.params.id}' not found`);

    // Check if user already has a companion
    const existing = await findExistingAdoption(db, user_id);
    if (existing) throw new AppError('CONFLICT', 'You already have a companion. Release them first before adopting a new one');

    const user_character_id = nanoid();
    const now = new Date().toISOString();

    try {
      await insertUserCharacter(db, {
        user_character_id,
        user_id,
        roster_id: rosterCharacter.roster_id,
        happiness_at_save: 100,
        last_interaction: now,
        level: 1,
        xp: 0,
        is_healthy: true,
      });
    } catch (dbError) {
      if (dbError.message?.includes('UNIQUE constraint failed')) {
        throw new AppError('CONFLICT', 'You already have a companion. Release them first before adopting a new one');
      }
      throw dbError;
    }

    // Auto-generate 5 daily quests for the new companion
    const dailyQuests = buildDefaultDailyQuests(user_id);
    for (const quest of dailyQuests) {
      await insertQuest(db, quest);
    }

    res.status(201).json({
      user_character_id,
      user_id,
      character_name: rosterCharacter.character_name,
      element: rosterCharacter.element,
      description: rosterCharacter.description,
      weapon_type: rosterCharacter.weapon_type,
      current_happiness: 100,
      level: 1,
      xp: 0,
      is_healthy: true,
      quests_created: dailyQuests.length,
      message: `${rosterCharacter.character_name} has been adopted! ${dailyQuests.length} daily quests are ready for you.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user-characters/:id/feed
 * Feed the companion: +20 happiness (capped at 100).
 */
export const feedCharacter = async (req, res, next) => {
  try {
    const character = await findUserCharacterById(db, req.params.id);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${req.params.id}' not found`);
    assertOwnership(character.user_id, req.user.user_id);
    if (!character.is_healthy) throw new AppError('VALIDATION_ERROR', `${character.character_name} is unhealthy and cannot be fed right now`);

    // Feeding consumes 1 food item from the owner's inventory — you can't
    // feed on an empty stomach's worth of nothing.
    const foodSlot = await findInventoryEntryByCategory(db, character.user_id, 'food');
    if (!foodSlot) {
      throw new AppError('VALIDATION_ERROR', `No food in your inventory! Visit the shop to buy some before feeding ${character.character_name}.`);
    }
    if (foodSlot.quantity > 1) {
      await updateInventoryQuantity(db, foodSlot.inventory_id, foodSlot.quantity - 1);
    } else {
      await removeInventoryEntry(db, foodSlot.inventory_id);
    }

    const currentHappiness = calcCurrentHappiness(character.happiness_at_save, character.last_interaction);
    const newHappiness = Math.min(100, currentHappiness + 20);
    const now = new Date().toISOString();

    // Auto-update is_healthy based on happiness
    const isHealthy = newHappiness > 0;
    await updateUserCharacter(db, req.params.id, { happiness_at_save: newHappiness, last_interaction: now, is_healthy: isHealthy });

    res.status(200).json({
      message: `${character.character_name} enjoyed the meal!`,
      current_happiness: newHappiness,
      is_healthy: isHealthy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user-characters/:id/play
 * Play with the companion: +10 happiness. Requires happiness >= 20.
 */
export const playWithCharacter = async (req, res, next) => {
  try {
    const character = await findUserCharacterById(db, req.params.id);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${req.params.id}' not found`);
    assertOwnership(character.user_id, req.user.user_id);
    if (!character.is_healthy) throw new AppError('VALIDATION_ERROR', `${character.character_name} is unhealthy and cannot play right now`);

    const currentHappiness = calcCurrentHappiness(character.happiness_at_save, character.last_interaction);
    if (currentHappiness < 20) throw new AppError('VALIDATION_ERROR', `Happiness too low to play (${currentHappiness}/100 — needs at least 20). Try feeding first!`);

    const newHappiness = Math.min(100, currentHappiness + 10);
    const now = new Date().toISOString();

    // Auto-update is_healthy based on happiness
    const isHealthy = newHappiness > 0;
    await updateUserCharacter(db, req.params.id, { happiness_at_save: newHappiness, last_interaction: now, is_healthy: isHealthy });

    res.status(200).json({
      message: `${character.character_name} had a great time playing!`,
      current_happiness: newHappiness,
      is_healthy: isHealthy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user-characters/:id
 * Release (delete) a user's companion.
 */
export const releaseCharacter = async (req, res, next) => {
  try {
    const character = await findUserCharacterById(db, req.params.id);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${req.params.id}' not found`);
    assertOwnership(character.user_id, req.user.user_id);

    // Delete all quests belonging to this user before releasing companion
    const userQuests = await findQuestsByUserId(db, character.user_id);
    for (const quest of userQuests) {
      await removeQuest(db, quest.quest_id);
    }

    // Delete all duel history for this companion (FK constraint) before releasing
    await removeDuelsByUserCharacterId(db, req.params.id);

    await removeUserCharacter(db, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};