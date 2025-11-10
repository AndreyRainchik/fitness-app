import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import PlateInventoryPreset from '../models/PlateInventoryPreset.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/plate-presets
 * Get all plate inventory presets for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const presets = PlateInventoryPreset.getByUser(req.user.id);
    
    // Parse plates JSON for each preset
    const formattedPresets = presets.map(preset => ({
      ...preset,
      plates: PlateInventoryPreset.parsePlates(preset)
    }));
    
    res.json({ presets: formattedPresets });
  } catch (error) {
    console.error('Get presets error:', error);
    res.status(500).json({ error: 'Failed to fetch plate inventory presets' });
  }
});

/**
 * GET /api/plate-presets/active
 * Get the active plate inventory preset
 */
router.get('/active', (req, res) => {
  try {
    let preset = PlateInventoryPreset.getActive(req.user.id);
    
    // If no active preset exists, create a default one
    if (!preset) {
      preset = PlateInventoryPreset.createDefaultPreset(req.user.id);
    }
    
    res.json({
      preset: {
        ...preset,
        plates: PlateInventoryPreset.parsePlates(preset)
      }
    });
  } catch (error) {
    console.error('Get active preset error:', error);
    res.status(500).json({ error: 'Failed to fetch active preset' });
  }
});

/**
 * GET /api/plate-presets/:id
 * Get a specific preset by ID
 */
router.get('/:id', (req, res) => {
  try {
    const preset = PlateInventoryPreset.getById(req.params.id);
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // Verify ownership
    if (preset.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      preset: {
        ...preset,
        plates: PlateInventoryPreset.parsePlates(preset)
      }
    });
  } catch (error) {
    console.error('Get preset error:', error);
    res.status(500).json({ error: 'Failed to fetch preset' });
  }
});

/**
 * POST /api/plate-presets
 * Create a new plate inventory preset
 */
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Preset name is required'),
    body('plates').isObject().withMessage('Plates must be an object'),
    body('bar_weight').isFloat({ min: 0 }).withMessage('Bar weight must be a positive number')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { name, plates, bar_weight } = req.body;
      
      const preset = PlateInventoryPreset.create({
        user_id: req.user.id,
        name,
        plates,
        bar_weight
      });
      
      res.status(201).json({
        message: 'Plate inventory preset created',
        preset: {
          ...preset,
          plates: PlateInventoryPreset.parsePlates(preset)
        }
      });
    } catch (error) {
      console.error('Create preset error:', error);
      
      // Handle unique constraint violation (duplicate name)
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'A preset with this name already exists' });
      }
      
      res.status(500).json({ error: 'Failed to create preset' });
    }
  }
);

/**
 * PUT /api/plate-presets/:id
 * Update a plate inventory preset
 */
router.put('/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('plates').optional().isObject().withMessage('Plates must be an object'),
    body('bar_weight').optional().isFloat({ min: 0 }).withMessage('Bar weight must be a positive number')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const preset = PlateInventoryPreset.getById(req.params.id);
      
      if (!preset) {
        return res.status(404).json({ error: 'Preset not found' });
      }
      
      // Verify ownership
      if (preset.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { name, plates, bar_weight } = req.body;
      
      const updatedPreset = PlateInventoryPreset.update(req.params.id, {
        name,
        plates,
        bar_weight
      });
      
      res.json({
        message: 'Preset updated',
        preset: {
          ...updatedPreset,
          plates: PlateInventoryPreset.parsePlates(updatedPreset)
        }
      });
    } catch (error) {
      console.error('Update preset error:', error);
      
      // Handle unique constraint violation
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'A preset with this name already exists' });
      }
      
      res.status(500).json({ error: 'Failed to update preset' });
    }
  }
);

/**
 * DELETE /api/plate-presets/:id
 * Delete a plate inventory preset
 */
router.delete('/:id', (req, res) => {
  try {
    const preset = PlateInventoryPreset.getById(req.params.id);
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // Verify ownership
    if (preset.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    PlateInventoryPreset.delete(req.params.id);
    
    res.json({ message: 'Preset deleted successfully' });
  } catch (error) {
    console.error('Delete preset error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/plate-presets/:id/activate
 * Set a preset as the active one
 */
router.post('/:id/activate', (req, res) => {
  try {
    const preset = PlateInventoryPreset.getById(req.params.id);
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // Verify ownership
    if (preset.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const activePreset = PlateInventoryPreset.setActive(req.params.id);
    
    res.json({
      message: 'Preset activated',
      preset: {
        ...activePreset,
        plates: PlateInventoryPreset.parsePlates(activePreset)
      }
    });
  } catch (error) {
    console.error('Activate preset error:', error);
    res.status(500).json({ error: 'Failed to activate preset' });
  }
});

/**
 * POST /api/plate-presets/:id/duplicate
 * Duplicate a preset with a new name
 */
router.post('/:id/duplicate',
  [
    body('name').trim().notEmpty().withMessage('New preset name is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const preset = PlateInventoryPreset.getById(req.params.id);
      
      if (!preset) {
        return res.status(404).json({ error: 'Preset not found' });
      }
      
      // Verify ownership
      if (preset.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { name } = req.body;
      const newPreset = PlateInventoryPreset.duplicate(req.params.id, name);
      
      res.status(201).json({
        message: 'Preset duplicated',
        preset: {
          ...newPreset,
          plates: PlateInventoryPreset.parsePlates(newPreset)
        }
      });
    } catch (error) {
      console.error('Duplicate preset error:', error);
      
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'A preset with this name already exists' });
      }
      
      res.status(500).json({ error: 'Failed to duplicate preset' });
    }
  }
);

export default router;