/**
 * Auth controller — registration and login.
 * Passwords are hashed with bcrypt before storage and are never returned
 * in any response. On successful login, a JWT is issued.
 */

import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { AppError } from '../utils/_errors.js';
import { signToken } from '../utils/jwt.js';
import { findUserByUsername, insertUser } from '../models/userModel.js';

const SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * Body: { username, password }
 * Creates a new account with a bcrypt-hashed password. Starts with 200 coins.
 */
export const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('VALIDATION_ERROR', errors.array()[0].msg);

    const { username, password } = req.body;

    const existing = await findUserByUsername(db, username);
    if (existing) throw new AppError('CONFLICT', `Username '${username}' is already taken`);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user_id = nanoid();
    await insertUser(db, { user_id, username, password: hashedPassword, coins: 200 });

    res.status(201).json({
      message: 'Account created! You can now log in.',
      user_id,
      username,
      coins: 200,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login
 * Body: { username, password }
 * Verifies credentials against the bcrypt hash and issues a JWT.
 */
export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('VALIDATION_ERROR', errors.array()[0].msg);

    const { username, password } = req.body;

    // findUserByUsername returns the password hash — used only for this internal check.
    const user = await findUserByUsername(db, username);
    if (!user) throw new AppError('UNAUTHORIZED', 'Incorrect username or password');

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) throw new AppError('UNAUTHORIZED', 'Incorrect username or password');

    const token = signToken({ user_id: user.user_id, username: user.username });

    res.status(200).json({
      message: `Welcome back, ${user.username}!`,
      token,
      user: { user_id: user.user_id, username: user.username, coins: user.coins },
    });
  } catch (error) {
    next(error);
  }
};
