/**
 * User character model — queries for the user_characters table.
 * Represents a user's adopted companion with their progress stats.
 * Happiness decay is calculated on-the-fly in the controller.
 */

import { eq } from 'drizzle-orm';
import { user_characters, character_roster } from '../db/schema.js';

/**
 * Find a user's adopted companion, joined with roster details.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @returns {Promise<Object|undefined>}
 */
export const findUserCharacterByUserId = async (db, user_id) => {
  const result = await db
    .select({
      user_character_id: user_characters.user_character_id,
      user_id: user_characters.user_id,
      roster_id: user_characters.roster_id,
      character_name: character_roster.character_name,
      element: character_roster.element,
      weapon_type: character_roster.weapon_type,
      description: character_roster.description,
      happiness_at_save: user_characters.happiness_at_save,
      last_interaction: user_characters.last_interaction,
      level: user_characters.level,
      xp: user_characters.xp,
      is_healthy: user_characters.is_healthy,
    })
    .from(user_characters)
    .innerJoin(character_roster, eq(user_characters.roster_id, character_roster.roster_id))
    .where(eq(user_characters.user_id, user_id));
  return result[0];
};

/**
 * Find a user character by user_character_id, joined with roster details.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_character_id
 * @returns {Promise<Object|undefined>}
 */
export const findUserCharacterById = async (db, user_character_id) => {
  const result = await db
    .select({
      user_character_id: user_characters.user_character_id,
      user_id: user_characters.user_id,
      roster_id: user_characters.roster_id,
      character_name: character_roster.character_name,
      element: character_roster.element,
      weapon_type: character_roster.weapon_type,
      description: character_roster.description,
      happiness_at_save: user_characters.happiness_at_save,
      last_interaction: user_characters.last_interaction,
      level: user_characters.level,
      xp: user_characters.xp,
      is_healthy: user_characters.is_healthy,
    })
    .from(user_characters)
    .innerJoin(character_roster, eq(user_characters.roster_id, character_roster.roster_id))
    .where(eq(user_characters.user_character_id, user_character_id));
  return result[0];
};

/**
 * Check if a user already has an adopted companion.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @returns {Promise<Object|undefined>}
 */
export const findExistingAdoption = async (db, user_id) => {
  const result = await db
    .select()
    .from(user_characters)
    .where(eq(user_characters.user_id, user_id));
  return result[0];
};

/**
 * Insert a new adopted companion.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {Object} data
 * @returns {Promise<void>}
 */
export const insertUserCharacter = async (db, data) => {
  await db.insert(user_characters).values(data);
};

/**
 * Update a user character's stats (happiness, xp, level, is_healthy).
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_character_id
 * @param {Object} fields
 * @returns {Promise<void>}
 */
export const updateUserCharacter = async (db, user_character_id, fields) => {
  await db.update(user_characters).set(fields).where(eq(user_characters.user_character_id, user_character_id));
};

/**
 * Delete a user's adopted companion (release).
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_character_id
 * @returns {Promise<void>}
 */
export const removeUserCharacter = async (db, user_character_id) => {
  await db.delete(user_characters).where(eq(user_characters.user_character_id, user_character_id));
};