import express from 'express';
import { Exercise } from '../models/index.js';

const router = express.Router();

/**
 * GET /api/exercises
 * Get all exercises (with optional filters)
 */
router.get('/', (req, res) => {
  try {
    const { category, muscle_group, compound } = req.query;
    
    let exercises;
    
    if (category) {
      exercises = Exercise.getByCategory(category);
    } else if (muscle_group) {
      exercises = Exercise.getByMuscleGroup(muscle_group);
    } else if (compound === 'true') {
      exercises = Exercise.getCompoundExercises();
    } else {
      exercises = Exercise.getAll();
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
    const muscleGroups = Exercise.getMuscleGroups();
    res.json({ muscle_groups: muscleGroups });
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
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const exercises = Exercise.search(q.trim());
    res.json({ exercises, count: exercises.length, query: q });
  } catch (error) {
    console.error('Search exercises error:', error);
    res.status(500).json({ error: 'Failed to search exercises' });
  }
});

/**
 * GET /api/exercises/:id
 * Get a specific exercise by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const exercise = Exercise.findById(id);
    
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