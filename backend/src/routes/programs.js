import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Program from '../models/Program.js';
import Exercise from '../models/Exercise.js';
import { all } from '../config/database.js';

const router = express.Router();

/**
 * @route   GET /api/programs
 * @desc    Get all programs for the authenticated user
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const programs = Program.getByUser(req.user.id);
    
    // Get lifts for each program
    const programsWithLifts = programs.map(program => {
      const lifts = all(
        `SELECT pl.*, e.name as exercise_name, e.category, e.primary_muscle_group
         FROM program_lifts pl
         JOIN exercises e ON pl.exercise_id = e.id
         WHERE pl.program_id = ?`,
        [program.id]
      );
      return { ...program, lifts };
    });
    
    res.json(programsWithLifts);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

/**
 * @route   GET /api/programs/active
 * @desc    Get the active program for the authenticated user
 * @access  Private
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const program = Program.getActiveByUser(req.user.id);
    
    if (!program) {
      return res.status(404).json({ error: 'No active program found' });
    }
    
    res.json(program);
  } catch (error) {
    console.error('Error fetching active program:', error);
    res.status(500).json({ error: 'Failed to fetch active program' });
  }
});

/**
 * @route   GET /api/programs/:id
 * @desc    Get a specific program with all lifts
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const program = Program.getWithLifts(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(program);
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ error: 'Failed to fetch program' });
  }
});

/**
 * @route   GET /api/programs/:id/current-week
 * @desc    Get the current week's workout for a program
 * @access  Private
 */
router.get('/:id/current-week', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const workout = Program.getCurrentWeekWorkout(req.params.id);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    res.json(workout);
  } catch (error) {
    console.error('Error fetching current week workout:', error);
    res.status(500).json({ error: 'Failed to fetch current week workout' });
  }
});

/**
 * @route   POST /api/programs
 * @desc    Create a new program
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, start_date, lifts, is_active } = req.body;
    
    // Validation
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    if (type !== '531' && type !== 'custom') {
      return res.status(400).json({ error: 'Type must be "531" or "custom"' });
    }
    
    // Create program
    const program = Program.create({
      user_id: req.user.id,
      name,
      type,
      start_date: start_date || new Date().toISOString().split('T')[0],
      current_week: 1,
      current_cycle: 1,
      is_active: is_active !== undefined ? is_active : 1
    });
    
    // Add lifts if provided
    if (lifts && Array.isArray(lifts)) {
      for (const lift of lifts) {
        if (lift.exercise_id && lift.training_max) {
          Program.addLift(program.id, lift.exercise_id, lift.training_max);
        }
      }
    }
    
    // Get the complete program with lifts
    const completeProgram = Program.getWithLifts(program.id);
    
    res.status(201).json(completeProgram);
  } catch (error) {
    console.error('Error creating program:', error);
    res.status(500).json({ error: 'Failed to create program' });
  }
});

/**
 * @route   PUT /api/programs/:id
 * @desc    Update a program
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, current_week, current_cycle, is_active } = req.body;
    
    const updatedProgram = Program.update(req.params.id, {
      name,
      current_week,
      current_cycle,
      is_active
    });
    
    res.json(updatedProgram);
  } catch (error) {
    console.error('Error updating program:', error);
    res.status(500).json({ error: 'Failed to update program' });
  }
});

/**
 * @route   DELETE /api/programs/:id
 * @desc    Delete a program
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    Program.delete(req.params.id);
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error) {
    console.error('Error deleting program:', error);
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

/**
 * @route   POST /api/programs/:id/advance-week
 * @desc    Advance program to the next week
 * @access  Private
 */
router.post('/:id/advance-week', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updatedProgram = Program.advanceWeek(req.params.id);
    res.json(updatedProgram);
  } catch (error) {
    console.error('Error advancing week:', error);
    res.status(500).json({ error: 'Failed to advance week' });
  }
});

/**
 * @route   POST /api/programs/:id/lifts
 * @desc    Add a lift to a program
 * @access  Private
 */
router.post('/:id/lifts', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { exercise_id, training_max } = req.body;
    
    if (!exercise_id || !training_max) {
      return res.status(400).json({ error: 'Exercise ID and training max are required' });
    }
    
    // Verify exercise exists
    const exercise = Exercise.findById(exercise_id);
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    
    const lift = Program.addLift(req.params.id, exercise_id, training_max);
    res.status(201).json(lift);
  } catch (error) {
    console.error('Error adding lift:', error);
    res.status(500).json({ error: 'Failed to add lift' });
  }
});

/**
 * @route   PUT /api/programs/:id/lifts/:exercise_id
 * @desc    Update a lift's training max
 * @access  Private
 */
router.put('/:id/lifts/:exercise_id', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { training_max } = req.body;
    
    if (!training_max) {
      return res.status(400).json({ error: 'Training max is required' });
    }
    
    const lift = Program.updateLift(req.params.id, req.params.exercise_id, training_max);
    res.json(lift);
  } catch (error) {
    console.error('Error updating lift:', error);
    res.status(500).json({ error: 'Failed to update lift' });
  }
});

/**
 * @route   DELETE /api/programs/:id/lifts/:exercise_id
 * @desc    Remove a lift from a program
 * @access  Private
 */
router.delete('/:id/lifts/:exercise_id', authenticateToken, async (req, res) => {
  try {
    const program = Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Verify ownership
    if (program.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    Program.removeLift(req.params.id, req.params.exercise_id);
    res.json({ success: true, message: 'Lift removed successfully' });
  } catch (error) {
    console.error('Error removing lift:', error);
    res.status(500).json({ error: 'Failed to remove lift' });
  }
});

export default router;