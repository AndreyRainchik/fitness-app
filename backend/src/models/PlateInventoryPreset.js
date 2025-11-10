import { get, all, run } from '../config/database.js';

/**
 * PlateInventoryPreset Model
 * Manages multiple plate inventory configurations per user
 */
class PlateInventoryPreset {
  /**
   * Get all presets for a user
   */
  static getByUser(userId) {
    return all(
      'SELECT * FROM plate_inventory_presets WHERE user_id = ? ORDER BY is_active DESC, name ASC',
      [userId]
    );
  }

  /**
   * Get active preset for a user
   */
  static getActive(userId) {
    return get(
      'SELECT * FROM plate_inventory_presets WHERE user_id = ? AND is_active = 1',
      [userId]
    );
  }

  /**
   * Get preset by ID
   */
  static getById(id) {
    return get('SELECT * FROM plate_inventory_presets WHERE id = ?', [id]);
  }

  /**
   * Create a new preset
   */
  static create({ user_id, name, plates, bar_weight = 45 }) {
    // Validate plates is an object
    const platesJson = typeof plates === 'string' ? plates : JSON.stringify(plates);
    run(
      `INSERT INTO plate_inventory_presets (user_id, name, plates, bar_weight, is_active)
       VALUES (?, ?, ?, ?, 0)`,
      [user_id, name, platesJson, bar_weight]
    );
    const newId = get(
        'SELECT * FROM plate_inventory_presets WHERE user_id = ? AND name = ?', [user_id, name]
    );
    // If no other 
    if(!this.getActive(user_id)) {
        this.setActive(newId.id);
    }
    return newId;
  }

  /**
   * Update a preset
   */
  static update(id, { name, plates, bar_weight }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (plates !== undefined) {
      updates.push('plates = ?');
      params.push(typeof plates === 'string' ? plates : JSON.stringify(plates));
    }

    if (bar_weight !== undefined) {
      updates.push('bar_weight = ?');
      params.push(bar_weight);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    run(
      `UPDATE plate_inventory_presets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getById(id);
  }

  /**
   * Delete a preset
   * Cannot delete if it's the only preset for the user
   */
  static delete(id) {
    const preset = this.getById(id);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Check if this is the only preset
    const userPresets = this.getByUser(preset.user_id);
    if (userPresets.length === 1) {
      throw new Error('Cannot delete the only preset. Create another preset first.');
    }

    // If this was the active preset, activate another one
    if (preset.is_active) {
      const otherPreset = userPresets.find(p => p.id !== id);
      if (otherPreset) {
        this.setActive(otherPreset.id);
      }
    }

    run('DELETE FROM plate_inventory_presets WHERE id = ?', [id]);
    return { success: true };
  }

  /**
   * Set a preset as active (deactivates all others for the user)
   */
  static setActive(id) {
    const preset = this.getById(id);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Deactivate all presets for this user
    run('UPDATE plate_inventory_presets SET is_active = 0 WHERE user_id = ?', [preset.user_id]);
    
    // Activate this preset
    run('UPDATE plate_inventory_presets SET is_active = 1 WHERE id = ?', [id]);
    
    return this.getById(id);
  }

  /**
   * Parse plates JSON and return as object
   */
  static parsePlates(preset) {
    if (!preset || !preset.plates) {
      return {};
    }
    
    try {
      return typeof preset.plates === 'string' ? JSON.parse(preset.plates) : preset.plates;
    } catch (error) {
      console.error('Error parsing plates:', error);
      return {};
    }
  }

  /**
   * Get formatted inventory (used for plate calculations)
   */
  static getInventoryFormat(preset) {
    return {
      plates: this.parsePlates(preset),
      bar_weight: preset.bar_weight || 45
    };
  }

  /**
   * Migrate existing plate inventory from users table to preset
   * Called once per user during migration
   */
  static migrateFromUserTable(userId) {
    // Get user's current plate inventory
    const user = get('SELECT plate_inventory, bar_weight FROM users WHERE id = ?', [userId]);
    
    if (!user || !user.plate_inventory) {
      // No inventory to migrate - create default preset
      return this.createDefaultPreset(userId);
    }

    try {
      const plates = JSON.parse(user.plate_inventory);
      const barWeight = user.bar_weight || 45;

      // Create "Default" preset
      const preset = this.create({
        user_id: userId,
        name: 'Default',
        plates: plates,
        bar_weight: barWeight
      });

      // Set as active
      this.setActive(preset.id);

      return preset;
    } catch (error) {
      console.error('Error migrating plate inventory:', error);
      return this.createDefaultPreset(userId);
    }
  }

  /**
   * Create default preset for new users
   */
  static createDefaultPreset(userId, units = 'lbs') {
    const defaultPlates = units === 'kg' 
      ? { "25": 2, "20": 2, "15": 2, "10": 4, "5": 4, "2.5": 2, "1.25": 2 }
      : { "45": 4, "25": 4, "10": 4, "5": 4, "2.5": 4 };
    
    const barWeight = units === 'kg' ? 20 : 45;

    const preset = this.create({
      user_id: userId,
      name: 'Default',
      plates: defaultPlates,
      bar_weight: barWeight
    });

    this.setActive(preset.id);
    return preset;
  }

  /**
   * Duplicate a preset with a new name
   */
  static duplicate(id, newName) {
    const original = this.getById(id);
    if (!original) {
      throw new Error('Preset not found');
    }

    return this.create({
      user_id: original.user_id,
      name: newName,
      plates: original.plates,
      bar_weight: original.bar_weight
    });
  }
}

export default PlateInventoryPreset;