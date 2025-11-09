import express from 'express';
import { body, validationResult } from 'express-validator';
import { User, BodyweightLog } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

/**
 * GET /api/profile
 * Get current user's full profile
 */
router.get('/', (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get latest bodyweight
    const latestBodyweight = BodyweightLog.getLatest(req.user.id);
    
    res.json({ 
      user: {
        ...user,
        currentBodyweight: latestBodyweight ? {
          weight: latestBodyweight.weight,
          date: latestBodyweight.date,
          units: latestBodyweight.units
        } : null
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/profile
 * Update user profile (username, units, sex)
 */
router.put('/',
  [
    body('username').optional().notEmpty().withMessage('Username cannot be empty'),
    body('units').optional().isIn(['kg', 'lbs']).withMessage('Units must be kg or lbs'),
    body('sex').optional().isIn(['M', 'F']).withMessage('Sex must be M or F'),
    body('bodyweight').optional().isFloat({ min: 0 }).withMessage('Bodyweight must be positive')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { username, units, sex, bodyweight } = req.body;
      const user = User.update(req.user.id, { username, units, sex, bodyweight });
      
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

/**
 * PUT /api/profile/password
 * Change user password
 */
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await User.changePassword(req.user.id, currentPassword, newPassword);
      
      res.json(result);
    } catch (error) {
      console.error('Change password error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/profile/email
 * Change user email
 */
router.put('/email',
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { email } = req.body;
      const user = User.changeEmail(req.user.id, email);
      
      res.json({
        message: 'Email updated successfully',
        user
      });
    } catch (error) {
      console.error('Change email error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/profile/bodyweight
 * Get bodyweight history for current user
 */
router.get('/bodyweight', (req, res) => {
  try {
    const { limit, start_date, end_date } = req.query;
    
    let logs;
    
    if (start_date && end_date) {
      logs = BodyweightLog.getByUserAndDateRange(req.user.id, start_date, end_date);
    } else {
      logs = BodyweightLog.getByUser(req.user.id, limit ? parseInt(limit) : null);
    }
    
    res.json({ bodyweightLogs: logs, count: logs.length });
  } catch (error) {
    console.error('Get bodyweight logs error:', error);
    res.status(500).json({ error: 'Failed to get bodyweight logs' });
  }
});

/**
 * GET /api/profile/bodyweight/latest
 * Get most recent bodyweight for current user
 */
router.get('/bodyweight/latest', (req, res) => {
  try {
    const latest = BodyweightLog.getLatest(req.user.id);
    
    if (!latest) {
      return res.status(404).json({ error: 'No bodyweight logs found' });
    }
    
    res.json({ bodyweight: latest });
  } catch (error) {
    console.error('Get latest bodyweight error:', error);
    res.status(500).json({ error: 'Failed to get latest bodyweight' });
  }
});

/**
 * POST /api/profile/bodyweight
 * Log a new bodyweight entry
 */
router.post('/bodyweight',
  [
    body('weight').isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
    body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('units').isIn(['kg', 'lbs']).withMessage('Units must be kg or lbs')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { weight, date, units } = req.body;
      
      const log = BodyweightLog.create({
        user_id: req.user.id,
        weight,
        date,
        units
      });
      
      // Also update user's current bodyweight in profile
      User.update(req.user.id, { bodyweight: weight, units });
      
      res.status(201).json({
        message: 'Bodyweight logged successfully',
        bodyweight: log
      });
    } catch (error) {
      console.error('Log bodyweight error:', error);
      res.status(500).json({ error: 'Failed to log bodyweight' });
    }
  }
);

/**
 * PUT /api/profile/bodyweight/:id
 * Update a bodyweight entry
 */
router.put('/bodyweight/:id',
  [
    body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be positive'),
    body('date').optional().isISO8601().withMessage('Valid date required'),
    body('units').optional().isIn(['kg', 'lbs']).withMessage('Units must be kg or lbs')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { id } = req.params;
      const log = BodyweightLog.findById(id);
      
      if (!log) {
        return res.status(404).json({ error: 'Bodyweight log not found' });
      }
      
      // Verify ownership
      if (log.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { weight, date, units } = req.body;
      const updatedLog = BodyweightLog.update(id, { weight, date, units });
      
      res.json({
        message: 'Bodyweight log updated successfully',
        bodyweight: updatedLog
      });
    } catch (error) {
      console.error('Update bodyweight log error:', error);
      res.status(500).json({ error: 'Failed to update bodyweight log' });
    }
  }
);

/**
 * DELETE /api/profile/bodyweight/:id
 * Delete a bodyweight entry
 */
router.delete('/bodyweight/:id', (req, res) => {
  try {
    const { id } = req.params;
    const log = BodyweightLog.findById(id);
    
    if (!log) {
      return res.status(404).json({ error: 'Bodyweight log not found' });
    }
    
    // Verify ownership
    if (log.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    BodyweightLog.delete(id);
    
    res.json({ message: 'Bodyweight log deleted successfully' });
  } catch (error) {
    console.error('Delete bodyweight log error:', error);
    res.status(500).json({ error: 'Failed to delete bodyweight log' });
  }
});

/**
 * GET /api/profile/bodyweight/trend
 * Get bodyweight trend over time
 */
router.get('/bodyweight/trend', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = BodyweightLog.getTrend(req.user.id, parseInt(days));
    
    res.json({ trend });
  } catch (error) {
    console.error('Get bodyweight trend error:', error);
    res.status(500).json({ error: 'Failed to get bodyweight trend' });
  }
});

/**
 * GET /api/profile/plate-inventory
 * Get user's plate inventory configuration
 */
router.get('/plate-inventory', (req, res) => {
  try {
    const inventory = User.getPlateInventory(req.user.id);
    
    if (!inventory) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(inventory);
  } catch (error) {
    console.error('Get plate inventory error:', error);
    res.status(500).json({ error: 'Failed to get plate inventory' });
  }
});

/**
 * PUT /api/profile/plate-inventory
 * Update user's plate inventory configuration
 */
router.put('/plate-inventory', (req, res) => {
  try {
    const { bar_weight, plates } = req.body;
    
    if (!plates || typeof plates !== 'object') {
      return res.status(400).json({ error: 'Plates configuration is required' });
    }
    
    const inventory = {
      bar_weight: bar_weight || 45,
      plates: plates
    };
    
    const updated = User.updatePlateInventory(req.user.id, inventory);
    res.json(updated);
  } catch (error) {
    console.error('Update plate inventory error:', error);
    res.status(500).json({ error: 'Failed to update plate inventory' });
  }
});

/**
 * POST /api/profile/calculate-plates
 * Calculate plates needed for a target weight
 */
router.post('/calculate-plates', (req, res) => {
  try {
    const { target_weight } = req.body;
    
    if (!target_weight || target_weight <= 0) {
      return res.status(400).json({ error: 'Valid target weight is required' });
    }
    
    const inventory = User.getPlateInventory(req.user.id);
    const result = User.calculatePlatesNeeded(target_weight, inventory);
    
    res.json(result);
  } catch (error) {
    console.error('Calculate plates error:', error);
    res.status(500).json({ error: 'Failed to calculate plates' });
  }
});

export default router;