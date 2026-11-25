/**
 * Duel routes — Core Mechanic 2: challenge a random rival and view results.
 */

import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createDuel, getDuelHistory, getLeaderboard } from '../controllers/duelController.js';

export const duelRouter = Router();

// GET /api/duels/leaderboard/top   — public leaderboard, no login required
duelRouter.get('/leaderboard/top', getLeaderboard);

// Everything else requires a logged-in user.
duelRouter.use(requireAuth);

// POST /api/duels                  — challenge a random rival with your companion
duelRouter.post('/', createDuel);

// GET /api/duels/:userCharacterId  — duel history for your companion
duelRouter.get('/:userCharacterId', getDuelHistory);
