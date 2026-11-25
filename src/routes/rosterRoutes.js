/**
 * Roster routes — browse the 7 preset elemental companions.
 * Adopt route lives here too since it starts from a roster character.
 */

import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getAllRosterCharacters, getRosterCharacterById } from '../controllers/rosterController.js';
import { adoptCharacter } from '../controllers/userCharacterController.js';

export const rosterRouter = Router();

// GET /api/roster          — see all 7 preset characters (public — browsing doesn't require login)
rosterRouter.get('/', getAllRosterCharacters);

// GET /api/roster/:id      — see one preset character (public)
rosterRouter.get('/:id', getRosterCharacterById);

// POST /api/roster/:id/adopt — logged-in user adopts this character
rosterRouter.post('/:id/adopt', requireAuth, adoptCharacter);