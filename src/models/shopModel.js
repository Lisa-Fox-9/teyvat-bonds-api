import { eq } from 'drizzle-orm';
import { shop_items } from '../db/schema.js';

/**
 * Retrieve all shop items. Optionally filter by category
 * @param {string} [category] - Category to filter by: food | weapon | outfit 
*/
export const findAllShopItems = async (db, category) => {
  if (category) {
    return db.select().from(shop_items).where(eq(shop_items.category, category));
  }
  return db.select().from(shop_items);
};

/**
 * Find a single shop item by item_id
 * @param {string} item_id
 */
export const findShopItemById = async (db, item_id) => {
  const result = await db.select().from(shop_items).where(eq(shop_items.item_id, item_id));
  return result[0];
};
