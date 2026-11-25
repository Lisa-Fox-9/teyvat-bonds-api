/**
 * Authentication middleware — verifies the JWT sent in the Authorization header.
 * Usage: app.use('/api/resource', requireAuth, resourceRouter);
 *
 * On success, attaches req.user = { user_id, username } so downstream
 * controllers can identify the logged-in user without trusting the request body.
 */

import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/_errors.js';

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header. Expected: Bearer <token>');
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);

    req.user = { user_id: decoded.user_id, username: decoded.username };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    // jsonwebtoken throws TokenExpiredError / JsonWebTokenError — normalise to 401
    next(new AppError('UNAUTHORIZED', 'Invalid or expired token. Please log in again'));
  }
};

/**
 * Ownership guard — call after requireAuth to ensure the logged-in user
 * matches the :userId route param (or a resolved owner id). Throws 403 otherwise.
 * @param {string} ownerId - the user_id that owns the resource being accessed
 * @param {string} requesterId - req.user.user_id
 */
export const assertOwnership = (ownerId, requesterId) => {
  if (ownerId !== requesterId) {
    throw new AppError('FORBIDDEN', 'You can only manage your own resources');
  }
};
