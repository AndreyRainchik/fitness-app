import express from 'express';
import { body, validationResult } from 'express-validator';
import { WorkoutTemplate, TemplateSet } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All template routes require authentication
router.use(authenticateToken);

/**
 * GET /api/templates
 * Get all templates for current user
 */
router.get('/', (req, res) => {
  try {
    const templates = WorkoutTemplate.getByUser(req.user.id);
    res.json({ templates, count: templates.length });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template with all sets
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = WorkoutTemplate.getWithDetails(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Ensure user owns this template
    if (template.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/',
  [
    body('name').isString().notEmpty().withMessage('Template name is required'),
    body('description').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { name, description } = req.body;
      
      const template = WorkoutTemplate.create({
        user_id: req.user.id,
        name,
        description: description || null
      });
      
      res.status(201).json({
        message: 'Template created successfully',
        template
      });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  }
);

/**
 * POST /api/templates/from-workout/:workoutId
 * Create a template from an existing workout
 */
router.post('/from-workout/:workoutId',
  [
    body('name').isString().notEmpty().withMessage('Template name is required'),
    body('description').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { workoutId } = req.params;
      const { name, description } = req.body;
      
      // Import Workout model here to avoid circular dependency
      const { Workout } = await import('../models/index.js');
      
      // Get the workout with all sets
      const workout = Workout.getWithDetails(workoutId);
      
      if (!workout) {
        return res.status(404).json({ error: 'Workout not found' });
      }
      
      // Ensure user owns this workout
      if (workout.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Create the template
      const template = WorkoutTemplate.create({
        user_id: req.user.id,
        name,
        description: description || null
      });
      
      // Copy all sets from workout to template
      workout.sets.forEach(set => {
        TemplateSet.create({
          template_id: template.id,
          exercise_id: set.exercise_id,
          set_number: set.set_number,
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          is_warmup: set.is_warmup,
          notes: set.notes
        });
      });
      
      // Return the template with all sets
      const fullTemplate = WorkoutTemplate.getWithDetails(template.id);
      
      res.status(201).json({
        message: 'Template created from workout successfully',
        template: fullTemplate
      });
    } catch (error) {
      console.error('Create template from workout error:', error);
      res.status(500).json({ error: 'Failed to create template from workout' });
    }
  }
);

/**
 * POST /api/templates/:id/start
 * Create a new workout from this template
 */
router.post('/:id/start',
  [
    body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { id } = req.params;
      const { date } = req.body;
      
      const workoutId = WorkoutTemplate.createWorkoutFromTemplate(
        id,
        req.user.id,
        date
      );
      
      res.status(201).json({
        message: 'Workout created from template successfully',
        workoutId
      });
    } catch (error) {
      console.error('Start workout from template error:', error);
      if (error.message === 'Template not found') {
        return res.status(404).json({ error: 'Template not found' });
      }
      if (error.message === 'Unauthorized') {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(500).json({ error: 'Failed to start workout from template' });
    }
  }
);

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id',
  [
    body('name').optional().isString(),
    body('description').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { id } = req.params;
      const template = WorkoutTemplate.findById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      if (template.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { name, description } = req.body;
      const updatedTemplate = WorkoutTemplate.update(id, { name, description });
      
      res.json({
        message: 'Template updated successfully',
        template: updatedTemplate
      });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }
);

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = WorkoutTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    WorkoutTemplate.delete(id);
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * POST /api/templates/:id/sets
 * Add a set to a template
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
      const template = WorkoutTemplate.findById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      if (template.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { exercise_id, set_number, reps, weight, rpe, is_warmup, notes } = req.body;
      
      const set = TemplateSet.create({
        template_id: id,
        exercise_id,
        set_number,
        reps,
        weight,
        rpe: rpe || null,
        is_warmup: is_warmup || 0,
        notes: notes || null
      });
      
      res.status(201).json({
        message: 'Set added to template successfully',
        set
      });
    } catch (error) {
      console.error('Create template set error:', error);
      res.status(500).json({ error: 'Failed to create template set' });
    }
  }
);

/**
 * PUT /api/templates/sets/:set_id
 * Update a template set
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
      const set = TemplateSet.findById(set_id);
      
      if (!set) {
        return res.status(404).json({ error: 'Set not found' });
      }
      
      // Verify ownership through template
      const template = WorkoutTemplate.findById(set.template_id);
      if (template.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { set_number, reps, weight, rpe, is_warmup, notes } = req.body;
      const updatedSet = TemplateSet.update(set_id, { set_number, reps, weight, rpe, is_warmup, notes });
      
      res.json({
        message: 'Template set updated successfully',
        set: updatedSet
      });
    } catch (error) {
      console.error('Update template set error:', error);
      res.status(500).json({ error: 'Failed to update template set' });
    }
  }
);

/**
 * DELETE /api/templates/sets/:set_id
 * Delete a template set
 */
router.delete('/sets/:set_id', (req, res) => {
  try {
    const { set_id } = req.params;
    const set = TemplateSet.findById(set_id);
    
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }
    
    // Verify ownership through template
    const template = WorkoutTemplate.findById(set.template_id);
    if (template.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    TemplateSet.delete(set_id);
    
    res.json({ message: 'Template set deleted successfully' });
  } catch (error) {
    console.error('Delete template set error:', error);
    res.status(500).json({ error: 'Failed to delete template set' });
  }
});

export default router;