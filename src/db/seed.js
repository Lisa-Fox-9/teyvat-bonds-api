
/**
 * Seed data and database reset script. Run with: npm run db
 *
 * To add your own seed data:
 *   1. Import your table schema from './schema.js'
 *   2. Add a sample data array
 *   3. Insert it inside the seed() function with db.insert()
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import your table schemas here
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { users, character_roster, user_characters, shop_items, user_inventory, quests, duels } from './schema.js';

// --- IDs ---

const userId1 = nanoid(); // Kaehara_Kazuha
const userId2 = nanoid(); // Tartaglia_Childe
const userId3 = nanoid(); // Focalors
const userId4 = nanoid(); // Andersdotter
const userId5 = nanoid(); // Illuga
const userId6 = nanoid(); // Yae_Miko
const userId7 = nanoid(); // Lord_Rukkhadevata

const rosterId_anemo    = nanoid();
const rosterId_geo      = nanoid();
const rosterId_hydro    = nanoid();
const rosterId_pyro     = nanoid();
const rosterId_cryo     = nanoid();
const rosterId_electro  = nanoid();
const rosterId_dendro   = nanoid();

const ucId1 = nanoid(); // Kazuha → Wanderer
const ucId2 = nanoid(); // Tartaglia → Zhongli
const ucId3 = nanoid(); // Focalors → Furina
const ucId4 = nanoid(); // Andersdotter → Durin
const ucId5 = nanoid(); // Illuga → Lohen
const ucId6 = nanoid(); // Yae_Miko → Raiden_Ei
const ucId7 = nanoid(); // Lord_Rukkhadevata → Nahida

// Shop item IDs
const itemId_chazuke    = nanoid();
const itemId_bamboo     = nanoid();
const itemId_justice    = nanoid();
const itemId_berry      = nanoid();
const itemId_bulle      = nanoid();
const itemId_tulayWand  = nanoid(); // Catalyst - Wanderer/Nahida
const itemId_vortex     = nanoid(); // Polearm - Zhongli/Lohen/Raiden
const itemId_splendor   = nanoid(); // Sword - Furina/Durin
const itemId_reliquary  = nanoid(); // Sword - Furina/Durin
const itemId_disaster   = nanoid(); // Polearm - Zhongli/Lohen/Raiden
const itemId_engulf     = nanoid(); // Polearm - Zhongli/Lohen/Raiden
const itemId_thousand   = nanoid(); // Catalyst - Wanderer/Nahida
const itemId_leyshard   = nanoid(); // Relic — rescues an unhealthy companion
const itemId_primogem   = nanoid(); // Relic — instantly grants +2 companion levels

const now = new Date().toISOString();

// --- Seed data ---

/** Sample tasks inserted when the database is reset.
const sampleTasks = [
  { title: 'Buy groceries', completed: false },
  { title: 'Read a book', completed: true },
  { title: 'Go for a walk', completed: false },
]; */

/** 7 preset elemental companions. */
const Roster = [
  {
    roster_id: rosterId_anemo,
    character_name: 'Wanderer',
    element: 'anemo',
    weapon_type: 'catalyst',
    description: 'A wandering wind spirit who has cast off his past. Aloof, sharp-tongued, but quietly kind.',
  },
  {
    roster_id: rosterId_geo,
    character_name: 'Zhongli',
    element: 'geo',
    weapon_type: 'polearm',
    description: 'An ancient geo archon in mortal guise. Refined, unhurried, and deeply wise.',
  },
  {
    roster_id: rosterId_hydro,
    character_name: 'Furina',
    element: 'hydro',
    weapon_type: 'sword',
    description: 'The former hydro archon of Fontaine. Theatrical and dramatic on the outside, tender on the inside.',
  },
  {
    roster_id: rosterId_pyro,
    character_name: 'Durin',
    element: 'pyro',
    weapon_type: 'sword',
    description: 'A great dragon of pyro born from an ancient alchemical experiment. Gentle despite his fearsome form.',
  },
  {
    roster_id: rosterId_cryo,
    character_name: 'Lohen',
    element: 'cryo',
    weapon_type: 'polearm',
    description: 'A cryo knight from the frozen north. Stoic, disciplined, and fiercely protective of those he guards.',
  },
  {
    roster_id: rosterId_electro,
    character_name: 'Raiden_Ei',
    element: 'electro',
    weapon_type: 'polearm',
    description: 'The electro archon of Inazuma. Serene and resolute, she carries the weight of eternity alone.',
  },
  {
    roster_id: rosterId_dendro,
    character_name: 'Nahida',
    element: 'dendro',
    weapon_type: 'catalyst',
    description: 'The dendro archon and Lesser Lord Kusanali. Curious, gentle, and overflowing with wisdom.',
  },
];

/** 7 users — one per companion for testing.
 * All seeded accounts share the plaintext password 'pass1234' — it is
 * bcrypt-hashed just before insertion inside seed() so the DB never stores
 * plaintext, matching how a real registration via POST /auth/register works. */
const SEED_PASSWORD = 'pass1234';
const sampleUsers = [
  { user_id: userId1, username: 'Kaehara_Kazuha',    password: SEED_PASSWORD, coins: 500 },
  { user_id: userId2, username: 'Tartaglia_Childe',  password: SEED_PASSWORD, coins: 300 },
  { user_id: userId3, username: 'Focalors',           password: SEED_PASSWORD, coins: 450 },
  { user_id: userId4, username: 'Andersdotter',       password: SEED_PASSWORD, coins: 200 },
  { user_id: userId5, username: 'Illuga',             password: SEED_PASSWORD, coins: 350 },
  { user_id: userId6, username: 'Yae_Miko',           password: SEED_PASSWORD, coins: 600 },
  { user_id: userId7, username: 'Lord_Rukkhadevata',  password: SEED_PASSWORD, coins: 400 },
];

/** Each user has adopted their companion. */
const sampleUserCharacters = [
  { user_character_id: ucId1, user_id: userId1, roster_id: rosterId_anemo,   happiness_at_save: 90,  last_interaction: now, level: 5,  xp: 420, is_healthy: true },
  { user_character_id: ucId2, user_id: userId2, roster_id: rosterId_geo,     happiness_at_save: 75,  last_interaction: now, level: 3,  xp: 220, is_healthy: true },
  { user_character_id: ucId3, user_id: userId3, roster_id: rosterId_hydro,   happiness_at_save: 100, last_interaction: now, level: 4,  xp: 310, is_healthy: true },
  { user_character_id: ucId4, user_id: userId4, roster_id: rosterId_pyro,    happiness_at_save: 60,  last_interaction: now, level: 2,  xp: 110, is_healthy: true },
  { user_character_id: ucId5, user_id: userId5, roster_id: rosterId_cryo,    happiness_at_save: 85,  last_interaction: now, level: 6,  xp: 550, is_healthy: true },
  { user_character_id: ucId6, user_id: userId6, roster_id: rosterId_electro, happiness_at_save: 95,  last_interaction: now, level: 10, xp: 920, is_healthy: true },
  { user_character_id: ucId7, user_id: userId7, roster_id: rosterId_dendro,  happiness_at_save: 80,  last_interaction: now, level: 7,  xp: 650, is_healthy: true },
];

/** Shop items — food, weapons (with weapon_type). */
const ShopItems = [
  // Food
  { item_id: itemId_chazuke,   item_name: 'Shimi Chazuke',           category: 'food',   weapon_type: null, cost: 25,  description: 'A comforting rice dish. Restores +20 happiness to your companion.' },
  { item_id: itemId_bamboo,    item_name: 'Bamboo Shoot Soup',        category: 'food',   weapon_type: null, cost: 30,  description: 'A warm and nourishing soup. Restores +25 happiness.' },
  { item_id: itemId_justice,   item_name: 'Pour la Justice',          category: 'food',   weapon_type: null, cost: 35,  description: 'A Fontaine specialty dessert. Restores +30 happiness.' },
  { item_id: itemId_berry,     item_name: 'Berry',                    category: 'food',   weapon_type: null, cost: 5,   description: 'A small sweet berry. Restores +5 happiness.' },
  { item_id: itemId_bulle,     item_name: 'Bulle Fruit',              category: 'food',   weapon_type: null, cost: 10,  description: 'A refreshing fruit from Fontaine. Restores +10 happiness.' },
  // Weapons — Catalyst
  { item_id: itemId_tulayWand, item_name: 'Tulaytullah\'s Remembrance', category: 'weapon', weapon_type: 'catalyst', cost: 400, description: 'A catalyst weapon of ancient design. Suited for Wanderer and Nahida.' },
  { item_id: itemId_thousand,  item_name: 'A Thousand Floating Dreams', category: 'weapon', weapon_type: 'catalyst', cost: 280, description: 'A dreamy catalyst that enhances elemental mastery. Suited for Wanderer and Nahida.' },
  // Weapons — Polearm
  { item_id: itemId_vortex,    item_name: 'Vortex Vanquisher',         category: 'weapon', weapon_type: 'polearm', cost: 320, description: 'A mighty polearm that commands the earth. Suited for Zhongli, Lohen, and Raiden Ei.' },
  { item_id: itemId_disaster,  item_name: 'Disaster and Remorse',      category: 'weapon', weapon_type: 'polearm', cost: 290, description: 'A polearm forged from grief and power. Suited for Zhongli, Lohen, and Raiden Ei.' },
  { item_id: itemId_engulf,    item_name: 'Engulfing Lightning',        category: 'weapon', weapon_type: 'polearm', cost: 210, description: 'A polearm crackling with electro energy. Suited for Zhongli, Lohen, and Raiden Ei.' },
  // Weapons — Sword
  { item_id: itemId_splendor,  item_name: 'Splendor of Tranquil Waters', category: 'weapon', weapon_type: 'sword', cost: 200, description: 'A graceful sword that flows like water. Suited for Furina and Durin.' },
  { item_id: itemId_reliquary, item_name: 'Athame Artis',          category: 'weapon', weapon_type: 'sword', cost: 275, description: 'A crimson ceremonial blade said to cut through illusion itself. Suited for Furina and Durin.' },
  // Relics — ultra-rare, not meant to be bought; only obtainable from a rare quest drop
  { item_id: itemId_leyshard, item_name: 'Primordial Ley Line Shard', category: 'relic', weapon_type: null, cost: 9999, description: 'A shard humming with raw ley line energy. Rescues a companion that has become unhealthy (0 happiness) — the one thing feeding or playing cannot do. Restores +20 happiness.', effect_type: 'happiness_rescue', effect_value: 20 },
  { item_id: itemId_primogem, item_name: 'Primogem',                 category: 'relic', weapon_type: null, cost: 9999, description: 'An iridescent crystal of concentrated elemental power. Instantly grants a companion +2 levels.', effect_type: 'level_boost', effect_value: 2 },
];

/** Starting inventory for seeded users. */
const sampleInventory = [
  { inventory_id: nanoid(), user_id: userId1, item_id: itemId_chazuke,   quantity: 3 },
  { inventory_id: nanoid(), user_id: userId1, item_id: itemId_tulayWand, quantity: 1 },
  { inventory_id: nanoid(), user_id: userId2, item_id: itemId_bamboo,    quantity: 2 },
  { inventory_id: nanoid(), user_id: userId2, item_id: itemId_vortex,    quantity: 1 },
  { inventory_id: nanoid(), user_id: userId3, item_id: itemId_justice,   quantity: 2 },
  { inventory_id: nanoid(), user_id: userId4, item_id: itemId_berry,     quantity: 5 },
  { inventory_id: nanoid(), user_id: userId5, item_id: itemId_bamboo,    quantity: 1 },
  { inventory_id: nanoid(), user_id: userId6, item_id: itemId_engulf,    quantity: 1 },
  { inventory_id: nanoid(), user_id: userId7, item_id: itemId_bulle,     quantity: 4 },
];

/**
 * Daily quests for each user — 5 quests per user.
 * quest_type: daily
 * reward_type: xp_only | coins | random_item
 */
const buildDailyQuests = (user_id) => [
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

const sampleQuests = [
  userId1, userId2, userId3, userId4, userId5, userId6, userId7,
].flatMap(buildDailyQuests);


// --- Seed function ---

/** Insert seed data into the database.
export const seed = async (db) => {
  await db.insert(tasks).values(sampleTasks);
  console.log(`  Inserted ${sampleTasks.length} tasks`);
};*/

export const seed = async (db) => {
  const hashedUsers = await Promise.all(
    sampleUsers.map(async (u) => ({ ...u, password: await bcrypt.hash(u.password, 10) }))
  );
  await db.insert(users).values(hashedUsers);
  console.log(`  Inserted ${sampleUsers.length} users`);

  await db.insert(character_roster).values(Roster);
  console.log(`  Inserted ${Roster.length} roster characters`);

  await db.insert(user_characters).values(sampleUserCharacters);
  console.log(`  Inserted ${sampleUserCharacters.length} adopted companions`);

  await db.insert(shop_items).values(ShopItems);
  console.log(`  Inserted ${ShopItems.length} shop items`);

  await db.insert(user_inventory).values(sampleInventory);
  console.log(`  Inserted ${sampleInventory.length} inventory entries`);

  await db.insert(quests).values(sampleQuests);
  console.log(`  Inserted ${sampleQuests.length} quests (5 per user)`);

  // A few sample duels so the leaderboard has data to show right away.
  const sampleDuels = [
    { duel_id: nanoid(), user_character_id: ucId1, opponent_roster_id: rosterId_geo,     result: 'win',  happiness_cost: 15, xp_earned: 45, coins_earned: 35 },
    { duel_id: nanoid(), user_character_id: ucId1, opponent_roster_id: rosterId_pyro,    result: 'win',  happiness_cost: 15, xp_earned: 50, coins_earned: 40 },
    { duel_id: nanoid(), user_character_id: ucId6, opponent_roster_id: rosterId_dendro,  result: 'win',  happiness_cost: 15, xp_earned: 55, coins_earned: 45 },
    { duel_id: nanoid(), user_character_id: ucId6, opponent_roster_id: rosterId_cryo,    result: 'loss', happiness_cost: 15, xp_earned: 10, coins_earned: 0 },
    { duel_id: nanoid(), user_character_id: ucId7, opponent_roster_id: rosterId_electro, result: 'win',  happiness_cost: 15, xp_earned: 40, coins_earned: 30 },
  ];
  await db.insert(duels).values(sampleDuels);
  console.log(`  Inserted ${sampleDuels.length} sample duels`);

  console.log('\n  Test IDs (copy these for Swagger testing):');
  console.log(`  User (Kaehara_Kazuha):           ${userId1}  — password: ${SEED_PASSWORD}`);
  console.log(`  User (Andersdotter):              ${userId4}  — password: ${SEED_PASSWORD}`);
  console.log(`  User (Lord_Rukkhadevata):         ${userId7}  — password: ${SEED_PASSWORD}`);
  console.log(`  User Character (Wanderer):        ${ucId1}`);
  console.log(`  User Character (Nahida):          ${ucId7}`);
  console.log(`  Roster ID (Wanderer/anemo):       ${rosterId_anemo}`);
  console.log(`  Roster ID (Durin/pyro):           ${rosterId_pyro}`);
  console.log(`  Item (Shimi Chazuke/food):        ${itemId_chazuke}`);
  console.log(`  Item (Tulaytullah/catalyst):      ${itemId_tulayWand}`);
};


// --- Database reset (no need to modify below) ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const dbPath = dbUrl.replace('file:', '');
const absoluteDbPath = path.resolve(projectRoot, dbPath);

const resetDatabase = async () => {
  try {
    // Step 1 — Delete the old database file
    if (fs.existsSync(absoluteDbPath)) {
      fs.unlinkSync(absoluteDbPath);
      console.log(`Deleted old database: ${dbPath}`);
    }

    // Step 2 — Recreate tables from schema.js
    console.log('Creating tables from schema...');
    execSync('npx drizzle-kit push', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Step 3 — Insert seed data
    console.log('Seeding database...');
    const { db } = await import('./connection.js');
    await seed(db);

    console.log('Done! Database is ready.');
  } catch (error) {
    console.error('Failed to reset database:', error.message);
    process.exit(1);
  }
};

resetDatabase();
