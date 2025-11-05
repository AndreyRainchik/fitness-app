import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request
 */
export const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    // Verify token
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      req.user = user;
    } catch (error) {
      // Token invalid, but that's okay for optional auth
      req.user = null;
    }
  }
  
  next();
};

export default {
  authenticateToken,
  optionalAuth
};