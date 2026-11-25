import { eq } from 'drizzle-orm';
import { quests } from '../db/schema.js';

/**
 * Retrieve all quests. Optionally filter by status
 * @param {string} [status] - active | completed
 */
export const findAllQuests = async (db, status) => {
  if (status) {
    return db.select().from(quests).where(eq(quests.status, status));
  }
  return db.select().from(quests);
};

/**
 * Find all quests belonging to a specific user
 * @param {string} user_id 
*/
export const findQuestsByUserId = async (db, user_id) => {
  return db.select().from(quests).where(eq(quests.user_id, user_id));
};

/**
 * Find a single quest by quest_id
 * @param {string} quest_id 
*/
export const findQuestById = async (db, quest_id) => {
  const result = await db.select().from(quests).where(eq(quests.quest_id, quest_id));
  return result[0];
};

/**
 * Insert a new quest
 * @param {Object} data
 */
export const insertQuest = async (db, data) => {
  await db.insert(quests).values(data);
};

/**
 * Update quest fields by quest_id (used to mark completed)
 * @param {string} quest_id
 * @param {Object} fields
 */
export const updateQuest = async (db, quest_id, fields) => {
  await db.update(quests).set(fields).where(eq(quests.quest_id, quest_id));
};

/**
 * Delete a quest by quest_id
 * @param {string} quest_id
 */
export const removeQuest = async (db, quest_id) => {
  await db.delete(quests).where(eq(quests.quest_id, quest_id));
};

