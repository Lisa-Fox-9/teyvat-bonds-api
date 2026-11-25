/**
 * User controller — validates input, calls userModel, sends HTTP responses.
 * All errors are forwarded to the global error handler via next(error).
 */

import { validationResult } from 'express-validator';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { assertOwnership } from '../middlewares/authMiddleware.js';
import {
  findAllUsers,
  findUserById,
  findUserByUsername,
  updateUser,
  removeUser,
} from '../models/userModel.js';

/**
 * GET /api/users
 * GET /api/users?username=aether
 * Returns all users, optionally filtered by username.
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const { username } = req.query;
    const result = await findAllUsers(db, username);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Returns a single user by user_id.
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await findUserById(db, req.params.id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.id}' not found`);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id
 * Updates a user's username and/or coins. Requires auth — a user may only edit their own account.
 */
export const editUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('VALIDATION_ERROR', errors.array()[0].msg);

    const user = await findUserById(db, req.params.id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.id}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    const { username, coins } = req.body;

    if (username && username !== user.username) {
      const conflict = await findUserByUsername(db, username);
      if (conflict) throw new AppError('CONFLICT', `Username '${username}' is already taken`);
    }

    const fields = {};
    if (username) fields.username = username;
    if (coins !== undefined) fields.coins = coins;

    await updateUser(db, req.params.id, fields);

    const updated = await findUserById(db, req.params.id);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id
 * Deletes a user account. Requires auth — a user may only delete their own account.
 */
export const deleteUser = async (req, res, next) => {
  try {
    const user = await findUserById(db, req.params.id);
    if (!user) throw new AppError('NOT_FOUND', `User with id '${req.params.id}' not found`);
    assertOwnership(user.user_id, req.user.user_id);

    await removeUser(db, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};