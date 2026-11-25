/**
 * Roster model — queries for the character_roster table.
 * These are the 7 preset elemental companions players can choose from.
 */

import { eq } from 'drizzle-orm';
import { character_roster } from '../db/schema.js';

/**
 * Retrieve all 7 preset characters in the roster.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @returns {Promise<Array>}
 */
export const findAllRosterCharacters = async (db) => {
  return db.select().from(character_roster);
};

/**
 * Find a single roster character by roster_id.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} roster_id
 * @returns {Promise<Object|undefined>}
 */
export const findRosterCharacterById = async (db, roster_id) => {
  const result = await db.select().from(character_roster).where(eq(character_roster.roster_id, roster_id));
  return result[0];
};

/**
 * Find a roster character by element.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} element
 * @returns {Promise<Object|undefined>}
 */
export const findRosterCharacterByElement = async (db, element) => {
  const result = await db.select().from(character_roster).where(eq(character_roster.element, element));
  return result[0];
};