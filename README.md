# Teyvat Bonds

Express.js + libSQL + Drizzle ORM backend, with a plain HTML/CSS/JS frontend, JWT authentication, and a Duel Arena battle mechanic — built for ST0503 Backend Web Development CA2.

## Game Theme Description

Teyvat Bonds is a Genshin Impact-inspired companion management game. Players create an account and adopt one of 7 preset elemental companions — Wanderer (Anemo), Zhongli (Geo), Furina (Hydro), Durin (Pyro), Lohen (Cryo), Raiden Ei (Electro) or Nahida (Dendro). Each companion has a happiness level that decays over time and must be maintained by feeding and playing.

Players earn coins, buy items from the shop (food and weapons), and complete daily quests to earn XP and level up their companion. New in CA2: once a companion is healthy and happy enough, it can enter the **Duel Arena** to challenge a random rival companion for XP and coins — winning and losing both cost happiness, so care and combat are directly linked. A public leaderboard ranks players by duel wins.

## Setup & Run Instructions

```bash
# 1. Clone the repo
git clone https://github.com/Lisa-Fox-9/teyvat-bonds-api.git
cd teyvat-bonds-api

# 2. Install dependencies
npm install

# 3. Create your .env from the example and set a JWT_SECRET
cp .env.example .env

# 4. Create and seed the database (drops + recreates local.db)
npm run db

# 5. Start the development server
npm run dev
```

Open **http://localhost:3000** for the game itself, or **http://localhost:3000/api-docs** for the Swagger API docs.

Set your own `JWT_SECRET` in `.env` (see `.env.example`). `npm run db` prints a set of test usernames (password `pass1234` for all seeded accounts) if you want to log in without registering.

## API Endpoints

### Auth

| Method | Endpoint         | Auth | Description                                         |
| ------ | ---------------- | ---- | ---------------------------------------------------- |
| POST   | /auth/register   | —    | Create an account (bcrypt-hashed password, 200 coins) |
| POST   | /auth/login      | —    | Verify credentials, issue a JWT                       |

### Users

| Method | Endpoint        | Auth | Description                                  |
| ------ | --------------- | ---- | --------------------------------------------- |
| GET    | /api/users      | —    | Get all users (supports ?username= filter)   |
| GET    | /api/users/:id  | —    | Get a user by ID                              |
| PUT    | /api/users/:id  | JWT  | Update username or coins (self only)          |
| DELETE | /api/users/:id  | JWT  | Delete a user account (self only)             |

### Roster & Companions

| Method | Endpoint                      | Auth | Description                                          |
| ------ | ------------------------------ | ---- | ------------------------------------------------------ |
| GET    | /api/roster                    | —    | Get all 7 preset elemental companions                  |
| GET    | /api/roster/:id                | —    | Get one roster character by ID                         |
| POST   | /api/roster/:id/adopt          | JWT  | Adopt a companion — auto-creates 5 daily quests         |
| GET    | /api/user-characters/:userId   | JWT  | Get your adopted companion with current_happiness (self only) |
| POST   | /api/user-characters/:id/feed  | JWT  | Feed companion (+20 happiness, self only)               |
| POST   | /api/user-characters/:id/play  | JWT  | Play with companion (+10 happiness, requires ≥20, self only) |
| DELETE | /api/user-characters/:id       | JWT  | Release companion (also deletes quests, self only)      |

### Shop & Inventory

| Method | Endpoint                             | Auth | Description                                          |
| ------ | ------------------------------------- | ---- | ------------------------------------------------------ |
| GET    | /api/shop                             | —    | Get all shop items (supports ?category= filter)        |
| POST   | /api/shop/buy                         | JWT  | Buy an item for the logged-in user (deducts coins, validates weapon type) |
| GET    | /api/inventory/:userId                | JWT  | Get your inventory with full item details (self only)  |
| POST   | /api/inventory/:userId/items/:itemId/use | JWT | Consume a relic to apply its effect (self only)      |
| DELETE | /api/inventory/:userId/items/:itemId  | JWT  | Remove an item from your inventory (self only)          |

### Quests

| Method | Endpoint                  | Auth | Description                                            |
| ------ | -------------------------- | ---- | -------------------------------------------------------- |
| GET    | /api/quests                | JWT  | Get all quests (supports ?status= filter)                |
| GET    | /api/quests/:userId        | JWT  | Get your quests, auto-resets completed dailies (self only) |
| POST   | /api/quests                | JWT  | Accept a new quest for the logged-in user                |
| PUT    | /api/quests/:id/complete   | JWT  | Complete a quest — awards XP, coins, or a random item     |
| DELETE | /api/quests/:id            | JWT  | Abandon a quest (self only)                               |

### Duel Arena — Core Mechanic 2

| Method | Endpoint                      | Auth | Description                                                       |
| ------ | ------------------------------ | ---- | -------------------------------------------------------------------- |
| POST   | /api/duels                     | JWT  | Challenge a random rival roster character to a duel (self only)     |
| GET    | /api/duels/:userCharacterId    | JWT  | Get duel history for your companion (self only)                     |
| GET    | /api/duels/leaderboard/top     | —    | Public leaderboard ranked by wins, then companion level              |

## Assumptions

- **Feeding requires food** — `POST /api/user-characters/:id/feed` requires and consumes exactly 1 food-category item from the owner's inventory (same consume-or-remove pattern used for quest item requirements). Feeding with an empty pantry is rejected with a clear error rather than silently succeeding.

- **Relic items have real effects, used via `POST /api/inventory/:userId/items/:itemId/use`** — a generic use-item endpoint reads `effect_type`/`effect_value` off the `shop_items` row (both null for every non-relic item) and applies it, then consumes one unit the same way item consumption works everywhere else in the app:
  - `Primogem` (`level_boost`, value 2) — grants +2 levels, implemented as +200 bonus XP (2 × `XP_PER_LEVEL`) rather than writing `level` directly, so it stays consistent with how quests and duels always *derive* level from xp — directly overwriting `level` would get silently reverted the next time xp changes elsewhere.
  - `Primordial Ley Line Shard` (`happiness_rescue`, value 20) — the only way to recover a companion once it's unhealthy (0 happiness); feed/play remain blocked while unhealthy exactly as before. Rejected with a 400 if used on an already-healthy companion.

- **Happiness decay** is calculated on-the-fly: `current_happiness = happiness_at_save - (minutes_since_last_interaction × 5)`. No cron job needed — the value is computed at read time. Minimum is 0, maximum is 100.

- **is_healthy** is automatically set to `false` when happiness reaches 0. The companion cannot feed, play, or duel while unhealthy.

- **Starting coins** — new users start with 200 coins. Additional coins are earned by completing Blossom of Wealth quests (random 50–200 coins) or winning duels (random 20–50 coins).

- **Weapon type validation** — each companion has a weapon type (catalyst, polearm, sword). Users can only buy weapons matching their companion's type.

- **Quest reward types** — `xp_only` awards XP to companion, `coins` awards random 50–200 coins, `random_item` awards a random shop item with weighted probability: 5% relic (ultra-rare, rarer than any weapon), 66% food, 29% weapon (matching companion's weapon type).

- **Daily quest auto-reset** — completed daily quests automatically reset to active on the next calendar day when `GET /api/quests/:userId` is called.

- **Auto-generated quests** — adopting a companion automatically creates 5 daily quests. Releasing a companion deletes all their quests to prevent orphaned data.

- **One companion per user** — a user can only have one companion at a time. They must release before adopting a new one.

- **Level-up formula** — `level = Math.floor(xp / 100) + 1`, capped at level 100 (max 9,900 XP total). The same formula and cap apply to XP earned from duels.

- **character_roster** is a global read-only table storing the 7 preset companions. It is not owned by any user.

- **Passwords** are hashed with bcrypt (10 salt rounds) before storage, both on `POST /auth/register` and in the seed script. Plaintext passwords are never stored or returned in any response.

- **JWT** is issued on login (`POST /auth/login`) and expires after 2 hours (`JWT_EXPIRES_IN` in `.env`). It carries only `user_id` and `username` — never the password.

- **Ownership enforcement** — protected routes read the acting user from the JWT (`req.user.user_id`), not from the request body or URL params. If the resource being accessed (companion, quest, inventory item, etc.) belongs to a different user, the request is rejected with `403 FORBIDDEN` even if the JWT itself is valid. This means route params like `:userId` are used to *locate* the resource, but never to *authorize* the action.

- **Duel Arena mechanic** — a companion can challenge a random opponent drawn from `character_roster` (excluding its own roster character) once it is healthy and has at least 30 happiness. Combat is resolved instantly using `level * 10 + random(0-30)` for the player vs. a similarly-scaled random opponent. Every duel — win or lose — costs 15 happiness, which is what ties the new mechanic back into the original companion-care loop: players can't duel endlessly without going back to feed/play first. Wins grant 30-60 XP and 20-50 coins; losses grant a small 5-15 XP consolation and no coins.

- **Quest mini-games** — completing a quest opens a themed interactive scene instead of instantly awarding the reward (`src/frontend/js/quest-scenes.js`):
  - *Gathering Fruit / Submit a Meal* — an NPC scene requesting the required item category.
  - *Explore the Wild* — a real-time keyboard-controlled (arrow keys/WASD) mini-game: move around a bounded map and collect randomly-spawning berries within a 12-second timer. More berries collected grants a bonus (`+8 coins per berry`), layered on top of the normal quest reward via the existing self-only `PUT /api/users/:id` endpoint — no new backend route was needed for this.
  - *Defeat Ley Line* — a genuine skill-based click-to-attack battle: click the slime (or an Attack button) to damage it, the slime counter-attacks on its own timer, first side to 0 HP loses. The slime has more HP than the companion (150 vs 100) and a 150ms per-click cooldown caps how fast damage can be dealt, so winning requires sustained, fast clicking rather than being a guaranteed outcome. Losing does **not** complete the quest — the player gets a Try Again / Retreat choice instead, preventing the mini-game from being trivially bypassed.
  - Any other/custom quest title (e.g. one created directly via `POST /api/quests`) falls back to a plain confirm-to-complete scene, so the mini-game system never blocks quests it doesn't recognize.

- **Leaderboard** is computed with a single aggregated SQL query (`COUNT` + `GROUP BY` in `duelModel.js`) rather than pulling all duel rows into the app and counting in JavaScript, so it scales with the database instead of app memory.

## Frontend

Plain HTML/CSS/JS (no framework), served statically from `src/frontend/` and talking to the API via `fetch`.

| Page          | Purpose                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| `login.html`    | Log in, receive and store a JWT                                        |
| `register.html` | Create an account, then auto-login                                     |
| `game.html`     | Main dashboard — tabbed views for Companion, Quests, Shop, Inventory, Duel Arena, and Leaderboard |

The JWT and logged-in user are kept in `localStorage` (`js/api.js`) so the session survives navigating between the three separate HTML pages. A shared `api()` fetch wrapper attaches the `Authorization: Bearer <token>` header automatically and normalises error responses so every page can just `try { ... } catch (err) { showFeedback(...) }`.

## Key Files

| File                              | Purpose                                                          |
| ---------------------------------- | ------------------------------------------------------------------ |
| `index.js`                         | App setup, middleware, route registration, global error handler  |
| `src/db/schema.js`                 | Drizzle table schemas                                            |
| `src/db/seed.js`                   | Database reset and seed script                                   |
| `src/models/`                      | Data access layer                                                 |
| `src/controllers/`                 | Request validation, business logic, response formatting          |
| `src/routes/`                      | Route to controller mapping                                       |
| `src/middlewares/authMiddleware.js`| `requireAuth` (JWT verification) and `assertOwnership` guard      |
| `src/utils/jwt.js`                 | JWT sign/verify helpers                                          |
| `src/utils/_errors.js`             | `AppError`, `ERROR_CODES`, and `errorHandler`                    |
| `src/frontend/`                    | Static frontend (login, register, game dashboard)                 |
| `_extras/erd.png`                  | Entity Relationship Diagram                                      |
| `_extras/tests/`                   | Infrastructure and baseline tests                                 |

## Scripts

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Start dev server with auto-reload         |
| `npm run db`     | Recreate DB and seed data                 |
| `npm test`       | Run test suite                            |
| `npm run export` | Export project zip (without node_modules) |
