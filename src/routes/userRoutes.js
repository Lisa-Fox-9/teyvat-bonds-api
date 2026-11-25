import { Router } from 'express';
import { body } from 'express-validator';
import { getAllUsers, getUserById, editUser, deleteUser } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

export const userRouter = Router();

// GET /api/users          — all users (supports ?username= filter)
userRouter.get('/', getAllUsers);

// GET /api/users/:id      — single user
userRouter.get('/:id', getUserById);

// Account creation happens via POST /auth/register (see authRoutes.js) so the
// password is always hashed on the way in — there is no unauthenticated way
// to create a user directly through this router.

// PUT /api/users/:id      — update username and/or coins (self only)
userRouter.put('/:id', requireAuth, [
  body().custom((_, { req }) => {
    if (!req.body.username && req.body.coins === undefined) {
      throw new Error('Provide at least one field to update: username or coins');
    }
    return true;
  }),
], editUser);

// DELETE /api/users/:id   — delete account (self only)
userRouter.delete('/:id', requireAuth, deleteUser);

