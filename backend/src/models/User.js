import { get, all, run } from '../config/database.js';
import bcrypt from 'bcryptjs';
import PlateInventoryPreset from './PlateInventoryPreset.js';

/** Emails are stored trimmed and lowercased, so sign-in ignores letter case. */
export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

/**
 * User Model
 * Handles user authentication and profile management
 */
class User {
  /**
   * Create a new user
   */
  static async create({ email: rawEmail, password, username, bodyweight = null, units = 'lbs', sex = null }) {
    try {
      const email = normalizeEmail(rawEmail);
      // Hash password
      const password_hash = await bcrypt.hash(password, 10);
      
      // Insert user
      run(
        `INSERT INTO users (email, password_hash, username, bodyweight, units, sex)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, password_hash, username, bodyweight, units, sex]
      );
      
      // Get the created user
      const user = get('SELECT * FROM users WHERE email = ?', [email]);
      if (bodyweight) {
        const user_id = user.id;
        const date = new Date(user.created_at).toISOString().split('T')[0];
        run(
          `INSERT INTO bodyweight_logs (user_id, date, weight, units)
           VALUES (?, ?, ?, ?)`,
           [user_id, date, bodyweight, units]
        );
      }
      
      // Remove password hash from returned user
      delete user.password_hash;
      delete user.token_version;
      
      return user;
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }
  
  /**
   * Find user by email
   */
  static findByEmail(email) {
    // Case-insensitive. Accounts made before emails were lowercased may
    // differ only in case; prefer the one typed exactly, then the oldest.
    const typed = String(email ?? '').trim();
    return get(
      'SELECT * FROM users WHERE email = ? COLLATE NOCASE ORDER BY email = ? DESC, id LIMIT 1',
      [typed, typed]
    );
  }
  
  /**
   * Find user by ID
   */
  static findById(id) {
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
      delete user.token_version;
    }
    return user;
  }
  
  /**
   * Verify password
   */
  static async verifyPassword(email, password) {
    const user = this.findByEmail(email);
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }
    
    // Return user without password hash
    delete user.password_hash;
    delete user.token_version;
    return user;
  }
  
  /**
   * Update user profile (basic info)
   */
  static update(id, { username, bodyweight, units, sex, plate_inventory, bar_weight }) {
    const updates = [];
    const params = [];
    
    if (username !== undefined) {
      updates.push('username = ?');
      params.push(username);
    }
    if (bodyweight !== undefined) {
      updates.push('bodyweight = ?');
      params.push(bodyweight);
    }
    if (units !== undefined) {
      updates.push('units = ?');
      params.push(units);
    }
    if (sex !== undefined) {
      updates.push('sex = ?');
      params.push(sex);
    }
    if (plate_inventory !== undefined) {
      updates.push('plate_inventory = ?');
      params.push(typeof plate_inventory === 'string' ? plate_inventory : JSON.stringify(plate_inventory));
    }
    if (bar_weight !== undefined) {
      updates.push('bar_weight = ?');
      params.push(bar_weight);
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Change user password
   */
  /** True when password is this user's current password. */
  static async checkPassword(id, password) {
    const row = get('SELECT password_hash FROM users WHERE id = ?', [id]);
    return Boolean(row && password && await bcrypt.compare(String(password), row.password_hash));
  }

  static async changePassword(id, currentPassword, newPassword) {
    try {
      // Get user with password hash
      const user = get('SELECT * FROM users WHERE id = ?', [id]);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      
      // Update password
      // Bumping token_version signs out every other session
      run(
        'UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
        [newPasswordHash, id]
      );
      
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      throw new Error(`Error changing password: ${error.message}`);
    }
  }
  
  /**
   * Change user email
   */
  static changeEmail(id, newEmail) {
    try {
      // Check if email already exists
      const existingUser = this.findByEmail(newEmail);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already in use');
      }
      
      // Update email
      run('UPDATE users SET email = ? WHERE id = ?', [normalizeEmail(newEmail), id]);
      
      return this.findById(id);
    } catch (error) {
      throw new Error(`Error changing email: ${error.message}`);
    }
  }
  
  /**
   * Delete user
   */
  static delete(id) {
    run('DELETE FROM users WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Get all users (admin function)
   */
  static getAll() {
    const users = all('SELECT id, email, username, bodyweight, units, sex, created_at FROM users');
    return users;
  }
  
  /**
   * Get default plate inventory based on units
   */
  static getDefaultPlateInventory(units = 'lbs') {
    if (units === 'kg') {
      return {
        bar_weight: 20,
        plates: {
          '25': 2,    // 25 kg plates (pairs)
          '20': 2,
          '15': 2,
          '10': 4,
          '5': 4,
          '2.5': 2,
          '1.25': 2
        }
      };
    } else {
      return {
        bar_weight: 45,
        plates: {
          '45': 4,    // 45 lb plates (pairs)
          '25': 4,
          '10': 4,
          '5': 4,
          '2.5': 4
        }
      };
    }
  }
  
  /**
   * Get plate inventory for a user (from active preset)
   */
  static getPlateInventory(id) {
    // Try to get active preset
    let preset = PlateInventoryPreset.getActive(id);
    
    // If no preset exists, migrate from old system or create default
    if (!preset) {
      const user = get('SELECT plate_inventory, bar_weight, units FROM users WHERE id = ?', [id]);
      
      if (user && user.plate_inventory) {
        // Migrate existing inventory to preset
        preset = PlateInventoryPreset.migrateFromUserTable(id);
      } else {
        throw new Error('Error updating plate inventory: no active plate preset selected');
      }
    }
    
    // Return in the format expected by calculatePlatesNeeded
    return PlateInventoryPreset.getInventoryFormat(preset);
  }
  
  /**
   * Update plate inventory (updates the active preset)
   */
  static updatePlateInventory(id, plates, barWeight) {
    try {
      // Get or create active preset
      let preset = PlateInventoryPreset.getActive(id);
      
      if (!preset) {
        // Create default preset first
        preset = PlateInventoryPreset.createDefaultPreset(id);
      }
      
      // Update the active preset
      PlateInventoryPreset.update(preset.id, {
        plates: plates,
        bar_weight: barWeight
      });
      
      return this.getPlateInventory(id);
    } catch (error) {
      throw new Error(`Error updating plate inventory: ${error.message}`);
    }
  }
  
  /**
   * Calculate plates needed for a target weight
   * Returns array of plates per side
   */
  static calculatePlatesNeeded(targetWeight, plateInventory) {
    const barWeight = plateInventory.bar_weight || 45;

    if (targetWeight == barWeight) {
      return { plates: [], per_side: 0, total: barWeight, exact: true };
    }
    const availablePlates = plateInventory.plates || {};
    
    // Calculate weight needed on each side
    let weightPerSide = (targetWeight - barWeight) / 2;
    
    if (weightPerSide <= 0) {
      return { plates: [], per_side: 0, total: barWeight };
    }
    
    // Sort plates by weight (descending)
    const plateSizes = Object.keys(availablePlates)
      .map(p => parseFloat(p))
      .sort((a, b) => b - a);
    
    const platesUsed = [];
    let remainingWeight = weightPerSide;
    
    // Greedy algorithm: use largest plates first
    for (const plateSize of plateSizes) {
      const available = availablePlates[plateSize.toString()] || 0;
      let count = 0;
      
      while (remainingWeight >= plateSize && count < available) {
        platesUsed.push(plateSize);
        remainingWeight -= plateSize;
        count++;
      }
    }
    
    // Round remaining weight to nearest 0.25
    remainingWeight = Math.round(remainingWeight * 4) / 4;
    
    return {
      plates: platesUsed,
      per_side: weightPerSide,
      total: barWeight + (platesUsed.reduce((sum, p) => sum + p, 0) * 2),
      exact: remainingWeight < 0.01 // Whether we achieved exact weight
    };
  }
}

export default User;