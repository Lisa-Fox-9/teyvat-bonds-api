/**
 * JWT helper — sign and verify tokens for session management.
 * Token payload only ever carries user_id and username — never the password.
 */

import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

/**
 * Sign a new JWT for a user.
 * @param {{ user_id: string, username: string }} payload
 * @returns {string} signed JWT
 */
export const signToken = (payload) => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

/**
 * Verify a JWT and return its decoded payload.
 * Throws if the token is missing, expired, or invalid — caller should catch.
 * @param {string} token
 * @returns {{ user_id: string, username: string, iat: number, exp: number }}
 */
export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};
