/**
 * Duel model — all database queries for the duels table (Core Mechanic 2).
 */

import { eq, desc, sql } from 'drizzle-orm';
import { duels, user_characters, character_roster, users } from '../db/schema.js';

/**
 * Insert a new duel record.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {Object} data
 * @returns {Promise<void>}
 */
export const insertDuel = async (db, data) => {
  await db.insert(duels).values(data);
};

/**
 * Delete all duel records for a companion. Must be called before deleting
 * the user_character row itself, since duels.user_character_id has a
 * foreign key back to user_characters — otherwise release fails with a
 * FOREIGN KEY constraint error.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_character_id
 * @returns {Promise<void>}
 */
export const removeDuelsByUserCharacterId = async (db, user_character_id) => {
  await db.delete(duels).where(eq(duels.user_character_id, user_character_id));
};

/**
 * Retrieve a companion's duel history, most recent first, joined with the
 * opponent's roster details.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_character_id
 * @returns {Promise<Array>}
 */
export const findDuelsByUserCharacterId = async (db, user_character_id) => {
  return db
    .select({
      duel_id: duels.duel_id,
      user_character_id: duels.user_character_id,
      opponent_name: character_roster.character_name,
      opponent_element: character_roster.element,
      result: duels.result,
      happiness_cost: duels.happiness_cost,
      xp_earned: duels.xp_earned,
      coins_earned: duels.coins_earned,
      created_at: duels.created_at,
    })
    .from(duels)
    .innerJoin(character_roster, eq(duels.opponent_roster_id, character_roster.roster_id))
    .where(eq(duels.user_character_id, user_character_id))
    .orderBy(desc(duels.created_at));
};

/**
 * Leaderboard — ranks users by duel win count (ties broken by companion level).
 * Aggregation (COUNT + GROUP BY) is done in SQL rather than pulled into JS,
 * so the database does the heavy lifting instead of the app scanning every row.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @returns {Promise<Array>}
 */
export const findLeaderboard = async (db) => {
  return db
    .select({
      username: users.username,
      character_name: character_roster.character_name,
      level: user_characters.level,
      wins: sql`COUNT(CASE WHEN ${duels.result} = 'win' THEN 1 END)`.mapWith(Number),
      losses: sql`COUNT(CASE WHEN ${duels.result} = 'loss' THEN 1 END)`.mapWith(Number),
    })
    .from(user_characters)
    .innerJoin(users, eq(user_characters.user_id, users.user_id))
    .innerJoin(character_roster, eq(user_characters.roster_id, character_roster.roster_id))
    .leftJoin(duels, eq(duels.user_character_id, user_characters.user_character_id))
    .groupBy(user_characters.user_character_id)
    .orderBy(desc(sql`COUNT(CASE WHEN ${duels.result} = 'win' THEN 1 END)`), desc(user_characters.level));
};
