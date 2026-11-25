/**
 * Auth routes — registration and login. Not protected by requireAuth
 * (you don't need a token to get one).
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController.js';

export const authRouter = Router();

// POST /auth/register — create a new account
authRouter.post('/register', [
  body('username').trim().notEmpty().withMessage('username is required')
    .isLength({ min: 3 }).withMessage('username must be at least 3 characters'),
  body('password').notEmpty().withMessage('password is required')
    .isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
], register);

// POST /auth/login — authenticate and receive a JWT
authRouter.post('/login', [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('password').notEmpty().withMessage('password is required'),
], login);
