
/**
 * All table schemas live here. Add new tables below and run `npm run db` to apply.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** Tasks table. */

/**
 * Users table — each player account.
 */
export const users = sqliteTable('users', {
  user_id: text('user_id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  coins: integer('coins').notNull().default(200),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * Character roster — 7 preset elemental companions.
 * element: pyro | hydro | anemo | electro | dendro | cryo | geo
 * weapon_type: catalyst | polearm | sword (used to validate weapon purchases)
 */
export const character_roster = sqliteTable('character_roster', {
  roster_id: text('roster_id').primaryKey(),
  character_name: text('character_name').notNull(),
  element: text('element').notNull(),
  weapon_type: text('weapon_type').notNull(),
  description: text('description').notNull(),
});

/**
 * User characters — a user's adopted companion and their progress.
 * One companion per user at a time.
 * Happiness decays over time — calculated on-the-fly, not stored.
 * Max level: 100
 */
export const user_characters = sqliteTable('user_characters', {
  user_character_id: text('user_character_id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.user_id),
  roster_id: text('roster_id').notNull().references(() => character_roster.roster_id),
  happiness_at_save: integer('happiness_at_save').notNull().default(100),
  last_interaction: text('last_interaction').notNull().$defaultFn(() => new Date().toISOString()),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  is_healthy: integer('is_healthy', { mode: 'boolean' }).notNull().default(true),
});

/**
 * Shop items — items available for purchase.
 * category: food | weapon | outfit
 * weapon_type: catalyst | polearm | sword | null (only for weapons)
 */
export const shop_items = sqliteTable('shop_items', {
  item_id: text('item_id').primaryKey(),
  item_name: text('item_name').notNull(),
  category: text('category').notNull(),
  weapon_type: text('weapon_type'),
  cost: integer('cost').notNull(),
  description: text('description').notNull(),
  // Only set on 'relic' items — what happens when a player uses one via
  // POST /api/inventory/:userId/items/:itemId/use. null for every other item.
  // effect_type: 'level_boost' | 'happiness_rescue' | null
  effect_type: text('effect_type'),
  effect_value: integer('effect_value'),
});

/**
 * User inventory — items a user owns.
 */
export const user_inventory = sqliteTable('user_inventory', {
  inventory_id: text('inventory_id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.user_id),
  item_id: text('item_id').notNull().references(() => shop_items.item_id),
  quantity: integer('quantity').notNull().default(1),
});

/**
 * Quests — missions users can accept and complete.
 * status: active | completed
 * quest_type: daily | special
 * required_item_category: food | weapon | null
 * reward_type: xp_only | coins | random_item
 * last_reset: ISO timestamp — used to check if daily quest can be reset
 */
export const quests = sqliteTable('quests', {
  quest_id: text('quest_id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.user_id),
  quest_title: text('quest_title').notNull(),
  quest_type: text('quest_type').notNull().default('daily'),
  status: text('status').notNull().default('active'),
  xp_reward: integer('xp_reward').notNull(),
  required_item_category: text('required_item_category'),
  reward_type: text('reward_type').notNull().default('xp_only'),
  last_reset: text('last_reset').$defaultFn(() => new Date().toISOString()),
});

/**
 * Duels — Core Mechanic 2. A user's companion challenges a random rival
 * companion drawn from the character_roster for a one-shot battle.
 * Dueling costs happiness and requires the companion to be healthy —
 * this is what ties Mechanic 2 back into Mechanic 1 (companion care).
 * result: win | loss
 */
export const duels = sqliteTable('duels', {
  duel_id: text('duel_id').primaryKey(),
  user_character_id: text('user_character_id').notNull().references(() => user_characters.user_character_id),
  opponent_roster_id: text('opponent_roster_id').notNull().references(() => character_roster.roster_id),
  result: text('result').notNull(),
  happiness_cost: integer('happiness_cost').notNull().default(15),
  xp_earned: integer('xp_earned').notNull().default(0),
  coins_earned: integer('coins_earned').notNull().default(0),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

