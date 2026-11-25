import { verifyToken } from '../utils/authToken.js';

/**
 * Authentication Middleware
 * Verifies the Bearer token and attaches its claims as req.user.
 *
 * Answers 401 for a missing, invalid, expired or revoked token (the password
 * was changed since). The frontend signs out on 401, and only then.
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required', code: 'auth_required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Your session has ended. Please sign in again.', code: 'auth_invalid' });
  }
  req.user = user;
  next();
};

export default {
  authenticateToken,
};
