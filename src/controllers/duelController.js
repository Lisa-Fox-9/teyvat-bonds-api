/**
 * Duel controller — Core Mechanic 2: Duel Arena.
 *
 * A user's companion challenges a random rival drawn from character_roster
 * (never their own companion's roster character) for a single, instantly
 * resolved battle. This is where Mechanic 2 ties back into Mechanic 1:
 * dueling costs happiness and an unhealthy companion cannot duel at all,
 * so players must keep feeding/playing to stay duel-ready.
 *
 * Combat resolution:
 *   companion_power = level * 10 + random(0-30)
 *   opponent_level   = companion level + random(-2..+3), min 1
 *   opponent_power    = opponent_level * 10 + random(0-25)
 *   Higher power wins. Ties favour the player.
 *
 * Rewards:
 *   Win  → 30-60 XP, 20-50 coins, win recorded
 *   Loss → 5-15 consolation XP, no coins, loss recorded
 *   Both → -15 happiness (min 0), unhealthy if it hits 0
 */

import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { assertOwnership } from '../middlewares/authMiddleware.js';
import { insertDuel, findDuelsByUserCharacterId, findLeaderboard } from '../models/duelModel.js';
import { findUserCharacterById, updateUserCharacter } from '../models/userCharacterModel.js';
import { findAllRosterCharacters } from '../models/rosterModel.js';
import { findUserById, updateUser } from '../models/userModel.js';

const HAPPINESS_COST = 15;
const MIN_HAPPINESS_TO_DUEL = 30;
const XP_PER_LEVEL = 100;
const MAX_LEVEL = 100;
const MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Pick a random opponent from the roster, excluding the player's own companion.
 * @param {Array} roster
 * @param {string} ownRosterId
 */
const pickOpponent = (roster, ownRosterId) => {
  const pool = roster.filter((r) => r.roster_id !== ownRosterId);
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Recalculate current happiness the same way userCharacterController does,
 * so a duel can't be requested against a stale happiness snapshot.
 */
const calcCurrentHappiness = (happiness_at_save, last_interaction) => {
  const DRAIN_RATE = 5;
  const minutesElapsed = Math.floor((Date.now() - new Date(last_interaction).getTime()) / 60000);
  return Math.max(0, happiness_at_save - minutesElapsed * DRAIN_RATE);
};

/**
 * POST /api/duels
 * Body: { user_character_id }
 * Resolves one duel for the caller's companion against a random rival.
 */
export const createDuel = async (req, res, next) => {
  try {
    const { user_character_id } = req.body;
    if (!user_character_id) throw new AppError('VALIDATION_ERROR', 'user_character_id is required');

    const character = await findUserCharacterById(db, user_character_id);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${user_character_id}' not found`);
    assertOwnership(character.user_id, req.user.user_id);

    if (!character.is_healthy) {
      throw new AppError('VALIDATION_ERROR', `${character.character_name} is unhealthy and cannot duel right now`);
    }

    const currentHappiness = calcCurrentHappiness(character.happiness_at_save, character.last_interaction);
    if (currentHappiness < MIN_HAPPINESS_TO_DUEL) {
      throw new AppError('VALIDATION_ERROR', `Happiness too low to duel (${currentHappiness}/100 — needs at least ${MIN_HAPPINESS_TO_DUEL})`);
    }

    const roster = await findAllRosterCharacters(db);
    const opponent = pickOpponent(roster, character.roster_id);

    const companionPower = character.level * 10 + randomInt(0, 30);
    const opponentLevel = Math.max(1, character.level + randomInt(-2, 3));
    const opponentPower = opponentLevel * 10 + randomInt(0, 25);

    const won = companionPower >= opponentPower;

    const xpEarned = won ? randomInt(30, 60) : randomInt(5, 15);
    const coinsEarned = won ? randomInt(20, 50) : 0;

    // Apply happiness cost on top of the freshly-calculated current happiness
    const newHappiness = Math.max(0, currentHappiness - HAPPINESS_COST);
    const isHealthy = newHappiness > 0;

    // Apply XP / level-up (capped at MAX_XP / MAX_LEVEL, same rule as quests)
    const newXp = Math.min(MAX_XP, character.xp + xpEarned);
    const newLevel = Math.min(MAX_LEVEL, Math.floor(newXp / XP_PER_LEVEL) + 1);
    const leveledUp = newLevel > character.level;

    await updateUserCharacter(db, user_character_id, {
      happiness_at_save: newHappiness,
      last_interaction: new Date().toISOString(),
      is_healthy: isHealthy,
      xp: newXp,
      level: newLevel,
    });

    if (coinsEarned > 0) {
      const user = await findUserById(db, character.user_id);
      await updateUser(db, character.user_id, { coins: user.coins + coinsEarned });
    }

    const duel_id = nanoid();
    await insertDuel(db, {
      duel_id,
      user_character_id,
      opponent_roster_id: opponent.roster_id,
      result: won ? 'win' : 'loss',
      happiness_cost: HAPPINESS_COST,
      xp_earned: xpEarned,
      coins_earned: coinsEarned,
    });

    res.status(201).json({
      message: won
        ? `${character.character_name} defeated ${opponent.character_name}!`
        : `${character.character_name} was bested by ${opponent.character_name}...`,
      result: won ? 'win' : 'loss',
      opponent: { character_name: opponent.character_name, element: opponent.element, power: opponentPower },
      companion_power: companionPower,
      xp_earned: xpEarned,
      coins_earned: coinsEarned,
      leveled_up: leveledUp,
      current_happiness: newHappiness,
      is_healthy: isHealthy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/duels/:userCharacterId
 * Returns the duel history for a companion (self only).
 */
export const getDuelHistory = async (req, res, next) => {
  try {
    const character = await findUserCharacterById(db, req.params.userCharacterId);
    if (!character) throw new AppError('NOT_FOUND', `Companion with id '${req.params.userCharacterId}' not found`);
    assertOwnership(character.user_id, req.user.user_id);

    const history = await findDuelsByUserCharacterId(db, req.params.userCharacterId);
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/duels/leaderboard/top
 * Public leaderboard ranked by win count, then companion level.
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await findLeaderboard(db);
    res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
};
