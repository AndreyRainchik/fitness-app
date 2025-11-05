import express from 'express';
import { body, validationResult } from 'express-validator';
import { Workout, Set } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All workout routes require authentication
router.use(authenticateToken);

/**
 * GET /api/workouts
 * Get all workouts for current user
 */
router.get('/', (req, res) => {
  try {
    const { limit, start_date, end_date } = req.query;
    
    let workouts;
    
    if (start_date && end_date) {
      workouts = Workout.getByUserAndDateRange(req.user.id, start_date, end_date);
    } else {
      workouts = Workout.getByUser(req.user.id, limit ? parseInt(limit) : null);
    }
    
    res.json({ workouts, count: workouts.length });
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Failed to get workouts' });
  }
});

/**
 * GET /api/workouts/:id
 * Get a specific workout with all sets
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const workout = Workout.getWithDetails(id);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Ensure user owns this workout
    if (workout.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ workout });
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({ error: 'Failed to get workout' });
  }
});

/**
 * POST /api/workouts
 * Create a new workout
 */
router.post('/',
  [
    body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('name').optional().isString(),
    body('notes').optional().isString(),
    body('duration_minutes').optional().isInt({ min: 0 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { date, name, notes, duration_minutes } = req.body;
      
      const workout = Workout.create({
        user_id: req.user.id,
        date,
        name: name || null,
        notes: notes || null,
        duration_minutes: duration_minutes || null
      });
      
      res.status(201).json({
        message: 'Workout created successfully',
        workout
      });
    } catch (error) {
      console.error('Create workout error:', error);
      res.status(500).json({ error: 'Failed to create workout' });
    }
  }
);

/**
 * PUT /api/workouts/:id
 * Update a workout
 */
router.put('/:id',
  [
    body('date').optional().isISO8601(),
    body('name').optional().isString(),
    body('notes').optional().isString(),
    body('duration_minutes').optional().isInt({ min: 0 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { id } = req.params;
      const workout = Workout.findById(id);
      
      if (!workout) {
        return res.status(404).json({ error: 'Workout not found' });
      }
      
      if (workout.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { date, name, notes, duration_minutes } = req.body;
      const updatedWorkout = Workout.update(id, { date, name, notes, duration_minutes });
      
      res.json({
        message: 'Workout updated successfully',
        workout: updatedWorkout
      });
    } catch (error) {
      console.error('Update workout error:', error);
      res.status(500).json({ error: 'Failed to update workout' });
    }
  }
);

/**
 * DELETE /api/workouts/:id
 * Delete a workout
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const workout = Workout.findById(id);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    if (workout.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    Workout.delete(id);
    
    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('Delete workout error:', error);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

/**
 * POST /api/workouts/:id/sets
 * Add a set to a workout
 */
router.post('/:id/sets',
  [
    body('exercise_id').isInt().withMessage('Exercise ID is required'),
    body('set_number').isInt({ min: 1 }).withMessage('Set number must be positive'),
    body('reps').isInt({ min: 0 }).withMessage('Reps must be positive'),
    body('weight').isFloat({ min: 0 }).withMessage('Weight must be positive'),
    body('rpe').optional().isFloat({ min: 0, max: 10 }),
    body('is_warmup').optional().isBoolean(),
    body('notes').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { id } = req.params;
      const workout = Workout.findById(id);
      
      if (!workout) {
        return res.status(404).json({ error: 'Workout not found' });
      }
      
      if (workout.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { exercise_id, set_number, reps, weight, rpe, is_warmup, notes } = req.body;
      
      const set = Set.create({
        workout_id: id,
        exercise_id,
        set_number,
        reps,
        weight,
        rpe: rpe || null,
        is_warmup: is_warmup || 0,
        notes: notes || null
      });
      
      res.status(201).json({
        message: 'Set added successfully',
        set
      });
    } catch (error) {
      console.error('Create set error:', error);
      res.status(500).json({ error: 'Failed to create set' });
    }
  }
);

/**
 * PUT /api/workouts/sets/:set_id
 * Update a set
 */
router.put('/sets/:set_id',
  [
    body('set_number').optional().isInt({ min: 1 }),
    body('reps').optional().isInt({ min: 0 }),
    body('weight').optional().isFloat({ min: 0 }),
    body('rpe').optional().isFloat({ min: 0, max: 10 }),
    body('is_warmup').optional().isBoolean(),
    body('notes').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { set_id } = req.params;
      const set = Set.findById(set_id);
      
      if (!set) {
        return res.status(404).json({ error: 'Set not found' });
      }
      
      // Verify ownership through workout
      const workout = Workout.findById(set.workout_id);
      if (workout.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { set_number, reps, weight, rpe, is_warmup, notes } = req.body;
      const updatedSet = Set.update(set_id, { set_number, reps, weight, rpe, is_warmup, notes });
      
      res.json({
        message: 'Set updated successfully',
        set: updatedSet
      });
    } catch (error) {
      console.error('Update set error:', error);
      res.status(500).json({ error: 'Failed to update set' });
    }
  }
);

/**
 * DELETE /api/workouts/sets/:set_id
 * Delete a set
 */
router.delete('/sets/:set_id', (req, res) => {
  try {
    const { set_id } = req.params;
    const set = Set.findById(set_id);
    
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }
    
    // Verify ownership through workout
    const workout = Workout.findById(set.workout_id);
    if (workout.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    Set.delete(set_id);
    
    res.json({ message: 'Set deleted successfully' });
  } catch (error) {
    console.error('Delete set error:', error);
    res.status(500).json({ error: 'Failed to delete set' });
  }
});

export default router;