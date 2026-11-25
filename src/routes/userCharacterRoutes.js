/**
 * User character routes — manage a user's adopted companion.
 */

import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getUserCharacter,
  feedCharacter,
  playWithCharacter,
  releaseCharacter,
} from '../controllers/userCharacterController.js';

export const userCharacterRouter = Router();

// All companion actions require a logged-in user.
userCharacterRouter.use(requireAuth);

// GET /api/user-characters/:userId      — get user's adopted companion
userCharacterRouter.get('/:userId', getUserCharacter);

// POST /api/user-characters/:id/feed    — feed companion (+20 happiness)
userCharacterRouter.post('/:id/feed', feedCharacter);

// POST /api/user-characters/:id/play    — play with companion (+10 happiness)
userCharacterRouter.post('/:id/play', playWithCharacter);

// DELETE /api/user-characters/:id       — release companion
userCharacterRouter.delete('/:id', releaseCharacter);