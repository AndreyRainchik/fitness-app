import express from 'express';
import { body, validationResult } from 'express-validator';
import { Exercise } from '../models/index.js';
import { EXERCISE_CATEGORIES } from '../models/Exercise.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * The exercise library: the built-in exercises plus the user's own custom
 * ones (nobody else's). Signed-in only, since custom names are the user's data.
 */
const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/exercises
 * Get all exercises (with optional filters)
 */
router.get('/', (req, res) => {
  try {
    const { category, muscle_group, compound } = req.query;
    const userId = req.user.id;

    let exercises;
    if (category) {
      exercises = Exercise.getByCategory(category, userId);
    } else if (muscle_group) {
      exercises = Exercise.getByMuscleGroup(muscle_group, userId);
    } else if (compound === 'true') {
      exercises = Exercise.getCompoundExercises(userId);
    } else {
      exercises = Exercise.getAll(userId);
    }

    res.json({ exercises, count: exercises.length });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ error: 'Failed to get exercises' });
  }
});

/**
 * GET /api/exercises/muscle-groups
 * Get list of all muscle groups
 */
router.get('/muscle-groups', (req, res) => {
  try {
    res.json({ muscle_groups: Exercise.getMuscleGroups(req.user.id) });
  } catch (error) {
    console.error('Get muscle groups error:', error);
    res.status(500).json({ error: 'Failed to get muscle groups' });
  }
});

/**
 * GET /api/exercises/search?q=bench
 * Search exercises by name
 */
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q || String(q).trim() === '') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const exercises = Exercise.search(String(q).trim(), req.user.id);
    res.json({ exercises, count: exercises.length, query: q });
  } catch (error) {
    console.error('Search exercises error:', error);
    res.status(500).json({ error: 'Failed to search exercises' });
  }
});

/**
 * POST /api/exercises
 * Create a custom exercise for this user.
 * Body: { name, category, primary_muscle_group, secondary_muscle_groups?, is_compound? }
 * 409 with { exercise } when one with that name already exists for them.
 */
router.post('/',
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Exercise name must be 2–100 characters'),
    body('category').isIn(EXERCISE_CATEGORIES).withMessage(`Category must be one of: ${EXERCISE_CATEGORIES.join(', ')}`),
    body('primary_muscle_group').isString().trim().isLength({ min: 2, max: 50 }).withMessage('Choose a muscle group'),
    body('secondary_muscle_groups').optional().isArray({ max: 10 }),
    body('secondary_muscle_groups.*').optional().isString().isLength({ max: 50 }),
    body('is_compound').optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    try {
      const { name, category, primary_muscle_group, secondary_muscle_groups = [], is_compound = false } = req.body;
      const existing = Exercise.findVisibleByName(name, req.user.id);
      if (existing) {
        return res.status(409).json({ error: `“${existing.name}” is already in your exercises`, exercise: existing });
      }

      const exercise = Exercise.create({
        user_id: req.user.id,
        name,
        category,
        primary_muscle_group,
        secondary_muscle_groups,
        is_compound,
      });
      res.status(201).json({ exercise: { ...exercise, is_custom: 1 } });
    } catch (error) {
      console.error('Create exercise error:', error);
      res.status(500).json({ error: 'Failed to create exercise' });
    }
  }
);

/**
 * GET /api/exercises/:id
 * Get a specific exercise by ID
 */
router.get('/:id', (req, res) => {
  try {
    const exercise = Exercise.findVisible(req.params.id, req.user.id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    res.json({ exercise });
  } catch (error) {
    console.error('Get exercise error:', error);
    res.status(500).json({ error: 'Failed to get exercise' });
  }
});

export default router;
