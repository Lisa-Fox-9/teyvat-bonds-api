/**
 * User model — all database queries for the users table.
 * No HTTP concerns here. Functions receive a db instance and return plain data.
 */

import { eq, like } from 'drizzle-orm';
import { users } from '../db/schema.js';

/**
 * Safe user fields — password is always excluded from API responses.
 * findUserByUsername is the only function that returns password (for internal auth checks only).
 */
const safeUserFields = {
  user_id: users.user_id,
  username: users.username,
  coins: users.coins,
  created_at: users.created_at,
};

/**
 * Retrieve all users without password. Optionally filter by username search string.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} [username] - Partial username to filter by.
 * @returns {Promise<Array>}
 */
export const findAllUsers = async (db, username) => {
  if (username) {
    return db.select(safeUserFields).from(users).where(like(users.username, `%${username}%`));
  }
  return db.select(safeUserFields).from(users);
};

/**
 * Find a single user by their user_id without password.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @returns {Promise<Object|undefined>}
 */
export const findUserById = async (db, user_id) => {
  const result = await db.select(safeUserFields).from(users).where(eq(users.user_id, user_id));
  return result[0];
};

/**
 * Find a single user by their username INCLUDING password.
 * Used internally for auth checks only — never send this response directly to the client.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} username
 * @returns {Promise<Object|undefined>}
 */
export const findUserByUsername = async (db, username) => {
  const result = await db.select().from(users).where(eq(users.username, username));
  return result[0];
};

/**
 * Insert a new user into the database.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {{ user_id: string, username: string, password: string, coins: number }} data
 * @returns {Promise<void>}
 */
export const insertUser = async (db, data) => {
  await db.insert(users).values(data);
};

/**
 * Update a user's username and/or coins by user_id.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @param {{ username?: string, coins?: number }} fields
 * @returns {Promise<void>}
 */
export const updateUser = async (db, user_id, fields) => {
  await db.update(users).set(fields).where(eq(users.user_id, user_id));
};

/**
 * Delete a user by user_id.
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @returns {Promise<void>}
 */
export const removeUser = async (db, user_id) => {
  await db.delete(users).where(eq(users.user_id, user_id));
};