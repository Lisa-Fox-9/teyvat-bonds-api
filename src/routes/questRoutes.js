/**
 * Quest routes — accept quests, complete them to earn XP and level up.
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getAllQuests,
  getQuestsByUser,
  acceptQuest,
  completeQuest,
  deleteQuest,
} from '../controllers/questController.js';

export const questRouter = Router();

questRouter.use(requireAuth);

// GET /api/quests?status=active    — all quests (supports ?status= filter)
questRouter.get('/', getAllQuests);

// GET /api/quests/:userId          — all quests for a specific user (self only)
questRouter.get('/:userId', getQuestsByUser);

// POST /api/quests                 — accept a new quest
questRouter.post('/', [
  body('quest_title').notEmpty().withMessage('quest_title is required'),
  body('xp_reward').isInt({ min: 1 }).withMessage('xp_reward must be a positive integer'),
], acceptQuest);

// PUT /api/quests/:id/complete     — complete a quest (awards XP to character)
questRouter.put('/:id/complete', [
  body('user_character_id').notEmpty().withMessage('user_character_id is required'),
], completeQuest);

// DELETE /api/quests/:id           — abandon a quest
questRouter.delete('/:id', deleteQuest);