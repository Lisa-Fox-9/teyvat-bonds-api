/**
 * Roster controller — browse the 7 preset elemental companions.
 * Users pick one from the roster to adopt.
 */

import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { findAllRosterCharacters, findRosterCharacterById } from '../models/rosterModel.js';

/**
 * GET /api/roster
 * Returns all 7 preset characters players can choose from.
 */
export const getAllRosterCharacters = async (req, res, next) => {
  try {
    const result = await findAllRosterCharacters(db);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/roster/:id
 * Returns a single roster character by roster_id.
 */
export const getRosterCharacterById = async (req, res, next) => {
  try {
    const character = await findRosterCharacterById(db, req.params.id);
    if (!character) throw new AppError('NOT_FOUND', `Roster character with id '${req.params.id}' not found`);
    res.status(200).json(character);
  } catch (error) {
    next(error);
  }
};