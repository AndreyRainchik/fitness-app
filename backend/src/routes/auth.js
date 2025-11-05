import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('username').notEmpty().withMessage('Username is required'),
    body('bodyweight').optional().isFloat({ min: 0 }).withMessage('Bodyweight must be a positive number'),
    body('units').optional().isIn(['kg', 'lbs']).withMessage('Units must be kg or lbs')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { email, password, username, bodyweight, units } = req.body;
      
      // Check if user already exists
      const existingUser = User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // Create user
      const user = await User.create({
        email,
        password,
        username,
        bodyweight: bodyweight || null,
        units: units || 'kg'
      });
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        message: 'User registered successfully',
        token,
        user
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
);

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { email, password } = req.body;
      
      // Verify credentials
      const user = await User.verifyPassword(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({
        message: 'Login successful',
        token,
        user
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me',
  authenticateToken,
  [
    body('username').optional().notEmpty().withMessage('Username cannot be empty'),
    body('bodyweight').optional().isFloat({ min: 0 }).withMessage('Bodyweight must be positive'),
    body('units').optional().isIn(['kg', 'lbs']).withMessage('Units must be kg or lbs')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { username, bodyweight, units } = req.body;
      const user = User.update(req.user.id, { username, bodyweight, units });
      
      res.json({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

export default router;