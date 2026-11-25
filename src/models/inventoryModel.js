/** 
 * Inventory model — all database queries for the user_inventory table.
 * Joins with shop_items so callers get full item details.
 */

import { eq, and } from 'drizzle-orm';
import { user_inventory, shop_items } from '../db/schema.js';

/**
 * Retrieve all inventory rows for a user, joined with item details
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const findInventoryByUserId = async (db, user_id) => {
  return db
    .select({
      inventory_id: user_inventory.inventory_id,
      user_id: user_inventory.user_id,
      quantity: user_inventory.quantity,
      item_id: shop_items.item_id,
      item_name: shop_items.item_name,
      category: shop_items.category,
      weapon_type: shop_items.weapon_type,
      cost: shop_items.cost,
      description: shop_items.description,
      effect_type: shop_items.effect_type,
      effect_value: shop_items.effect_value,
    })
    .from(user_inventory)
    .innerJoin(shop_items, eq(user_inventory.item_id, shop_items.item_id))
    .where(eq(user_inventory.user_id, user_id));
};

/**
 * Find a specific inventory row for a user + item combination
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @param {string} item_id
 * @returns {Promise<Object|undefined>}
 */
export const findInventoryEntry = async (db, user_id, item_id) => {
  const result = await db
    .select()
    .from(user_inventory)
    .where(and(eq(user_inventory.user_id, user_id), eq(user_inventory.item_id, item_id)));
  return result[0];
};

/**
 * Find the first inventory entry matching a user + item catetory (used for quest checks)
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} user_id
 * @param {string} category
 * @returns {Promise<Object|undefined>} 
*/
export const findInventoryEntryByCategory = async (db, user_id, category) => {
  const result = await db
    .select({
      inventory_id: user_inventory.inventory_id,
      quantity: user_inventory.quantity,
      item_id: shop_items.item_id,
      category: shop_items.category,
    })
    .from(user_inventory)
    .innerJoin(shop_items, eq(user_inventory.item_id, shop_items.item_id))
    .where(and(eq(user_inventory.user_id, user_id), eq(shop_items.category, category)));
  return result[0];
};

/**
 * Insert a new inventory row
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {Object} data
 * @returns {Promise<void>}
*/
export const insertInventoryEntry = async (db, data) => {
  await db.insert(user_inventory).values(data);
};

/**
 * Update the quantity of an existing inventory row
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} inventory_id
 * @param {number} quantity
 * @returns {Promise<void>} 
*/
export const updateInventoryQuantity = async (db, inventory_id, quantity) => {
  await db.update(user_inventory).set({ quantity }).where(eq(user_inventory.inventory_id, inventory_id));
};

/**
 * Delete an inventory row by inventory_id
 * @param {import('drizzle-orm/libsql').LibSQLDatabase} db
 * @param {string} inventory_id
 * @returns {Promise<void>} 
*/
export const removeInventoryEntry = async (db, inventory_id) => {
  await db.delete(user_inventory).where(eq(user_inventory.inventory_id, inventory_id));
};
