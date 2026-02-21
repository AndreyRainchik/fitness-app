import express from 'express';
import { body, validationResult } from 'express-validator';
import { Workout, Set, Exercise } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { all } from '../config/database.js';
import { estimate1RM } from '../utils/strengthCalculations.js';

/**
 * Returns true when the exercise supports negative weights (i.e. machine
 * assistance is recorded as a negative number rather than an absolute stack
 * weight).  Exercises whose name contains the word "assisted" (case-
 * insensitive) are treated as assisted.
 */
function isAssistedExercise(exercise) {
  return exercise && exercise.name.toLowerCase().includes('assisted');
}

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
 * GET /api/workouts/:id/with-prs
 * Get a specific workout with PR detection for each set
 * 
 * Returns workout with additional PR flags on each set:
 * - isVolumePR: boolean - true if this set has the highest volume (weight × reps)
 * - is1RMPR: boolean - true if this set has the highest estimated 1RM
 * - estimated1RM: number - calculated 1RM for this set
 */
router.get('/:id/with-prs', (req, res) => {
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
    
    // If no sets, return workout as-is
    if (!workout.sets || workout.sets.length === 0) {
      return res.json({ workout, prSummary: [] });
    }
    
    // Detect PRs for each set
    const setsWithPRs = detectPRsForWorkout(workout, req.user.id);
    
    // Create PR summary for celebration banner
    const prSummary = createPRSummary(setsWithPRs);
    
    // Return workout with enhanced sets
    res.json({
      workout: {
        ...workout,
        sets: setsWithPRs
      },
      prSummary
    });
    
  } catch (error) {
    console.error('Get workout with PRs error:', error);
    res.status(500).json({ error: 'Failed to get workout with PRs' });
  }
});

/**
 * UPDATED: Helper function to detect PRs for all sets in a workout
 * Now properly identifies only the BEST set(s) per exercise as PRs
 * Handles ties correctly (multiple sets with same best value)
 */
function detectPRsForWorkout(workout, userId) {
  // First, group sets by exercise to find the best in THIS workout
  const exerciseGroups = {};
  
  workout.sets.forEach(set => {
    if (!exerciseGroups[set.exercise_id]) {
      exerciseGroups[set.exercise_id] = [];
    }
    exerciseGroups[set.exercise_id].push(set);
  });
  
  // For each exercise, determine which sets are PRs
  const prFlags = {}; // Store PR decisions by set ID
  
  Object.entries(exerciseGroups).forEach(([exerciseId, sets]) => {
    // Skip warmup sets
    const workingSets = sets.filter(s => s.is_warmup !== 1);
    
    if (workingSets.length === 0) {
      // Mark all warmup sets as non-PRs
      sets.forEach(set => {
        prFlags[set.id] = {
          isVolumePR: false,
          is1RMPR: false,
          estimated1RM: 0
        };
      });
      return;
    }
    
    // Calculate metrics for all working sets in this workout
    const setsWithMetrics = workingSets.map(set => ({
      ...set,
      volume: set.weight * set.reps,
      estimated1RM: estimate1RM(set.weight, set.reps)
    }));
    
    // Find the best volume and best 1RM in THIS workout
    const bestVolume = Math.max(...setsWithMetrics.map(s => s.volume));
    const best1RM = Math.max(...setsWithMetrics.map(s => s.estimated1RM));
    
    // Get historical data for this exercise
    const previousSets = all(
      `SELECT s.weight, s.reps
       FROM sets s
       INNER JOIN workouts w ON s.workout_id = w.id
       WHERE w.user_id = ?
         AND s.exercise_id = ?
         AND s.workout_id != ?
         AND s.is_warmup = 0
       ORDER BY w.date DESC`,
      [userId, exerciseId, workout.id]
    );
    
    // Calculate historical bests.
    // Initialize to -Infinity so that negative values (e.g. assisted pull-up
    // volumes / 1RMs) are captured correctly — Math.max semantics apply and
    // "higher is better" remains true across the full numeric range.
    let historicalBestVolume = -Infinity;
    let historicalBest1RM = -Infinity;

    previousSets.forEach(prevSet => {
      const prevVolume = prevSet.weight * prevSet.reps;
      const prev1RM = estimate1RM(prevSet.weight, prevSet.reps);

      if (prevVolume > historicalBestVolume) {
        historicalBestVolume = prevVolume;
      }
      if (prev1RM > historicalBest1RM) {
        historicalBest1RM = prev1RM;
      }
    });
    
    // Determine if the bests in this workout are PRs
    const isVolumePR = previousSets.length === 0 || bestVolume > historicalBestVolume;
    const is1RMPR = previousSets.length === 0 || best1RM > historicalBest1RM;
    
    // Mark all sets for this exercise
    setsWithMetrics.forEach(set => {
      prFlags[set.id] = {
        // Only mark as PR if this set matches the best value AND it's a PR
        isVolumePR: isVolumePR && set.volume === bestVolume,
        is1RMPR: is1RMPR && set.estimated1RM === best1RM,
        estimated1RM: Math.round(set.estimated1RM * 10) / 10
      };
    });
    
    // Mark warmup sets as non-PRs
    sets.filter(s => s.is_warmup === 1).forEach(set => {
      prFlags[set.id] = {
        isVolumePR: false,
        is1RMPR: false,
        estimated1RM: 0
      };
    });
  });
  
  // Apply flags to all sets
  return workout.sets.map(set => ({
    ...set,
    ...(prFlags[set.id] || {
      isVolumePR: false,
      is1RMPR: false,
      estimated1RM: 0
    })
  }));
}


/**
 * Helper function to create PR summary for celebration banner
 */
function createPRSummary(sets) {
  const prSets = sets.filter(set => set.isVolumePR || set.is1RMPR);
  
  if (prSets.length === 0) {
    return [];
  }
  
  // Group PRs by exercise
  const prsByExercise = {};
  
  prSets.forEach(set => {
    if (!prsByExercise[set.exercise_name]) {
      prsByExercise[set.exercise_name] = {
        exerciseName: set.exercise_name,
        volumePRs: [],
        oneRMPRs: []
      };
    }
    
    if (set.isVolumePR) {
      prsByExercise[set.exercise_name].volumePRs.push({
        weight: set.weight,
        reps: set.reps,
        volume: set.weight * set.reps,
        setNumber: set.set_number
      });
    }
    
    if (set.is1RMPR) {
      prsByExercise[set.exercise_name].oneRMPRs.push({
        weight: set.weight,
        reps: set.reps,
        estimated1RM: set.estimated1RM,
        setNumber: set.set_number
      });
    }
  });
  
  // Convert to array format
  return Object.values(prsByExercise);
}

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
    body('weight').isFloat().withMessage('Weight must be a number'),
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

      // Negative weights are only meaningful for assisted exercises (e.g.
      // Machine-Assisted Pull-up where the stack reduces effective load).
      if (weight < 0) {
        const exercise = Exercise.findById(exercise_id);
        if (!isAssistedExercise(exercise)) {
          return res.status(400).json({ error: 'Weight must be positive for this exercise' });
        }
      }
      
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
    body('weight').optional().isFloat(),
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

      // Negative weights are only valid for assisted exercises.
      if (weight !== undefined && weight < 0) {
        const exercise = Exercise.findById(set.exercise_id);
        if (!isAssistedExercise(exercise)) {
          return res.status(400).json({ error: 'Weight must be positive for this exercise' });
        }
      }
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