import { get, all, run } from '../config/database.js';
import bcrypt from 'bcryptjs';

/**
 * User Model
 * Handles user authentication and profile management
 */
class User {
  /**
   * Create a new user
   */
  static async create({ email, password, username, bodyweight = null, units = 'kg', sex = null }) {
    try {
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
      
      // Remove password hash from returned user
      delete user.password_hash;
      
      return user;
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }
  
  /**
   * Find user by email
   */
  static findByEmail(email) {
    return get('SELECT * FROM users WHERE email = ?', [email]);
  }
  
  /**
   * Find user by ID
   */
  static findById(id) {
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
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
      run(
        'UPDATE users SET password_hash = ? WHERE id = ?',
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
      run('UPDATE users SET email = ? WHERE id = ?', [newEmail, id]);
      
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
          '25': 4,    // 25 kg plates (pairs)
          '20': 4,
          '15': 2,
          '10': 4,
          '5': 4,
          '2.5': 4,
          '1.25': 4,
          '0.5': 2,
          '0.25': 2
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
          '2.5': 4,
          '1': 2,
          '0.75': 2,
          '0.5': 2,
          '0.25': 2
        }
      };
    }
  }
  
  /**
   * Get user's plate inventory
   * Returns default if not set
   */
  static getPlateInventory(id) {
    const user = get('SELECT plate_inventory, bar_weight, units FROM users WHERE id = ?', [id]);
    if (!user) {
      return null;
    }
    
    // If plate_inventory is not set, return defaults
    if (!user.plate_inventory) {
      return this.getDefaultPlateInventory(user.units);
    }
    
    try {
      const inventory = JSON.parse(user.plate_inventory);
      // Ensure bar_weight is included
      if (!inventory.bar_weight && user.bar_weight) {
        inventory.bar_weight = user.bar_weight;
      } else if (!inventory.bar_weight) {
        inventory.bar_weight = user.units === 'kg' ? 20 : 45;
      }
      return inventory;
    } catch (error) {
      console.error('Error parsing plate inventory:', error);
      return this.getDefaultPlateInventory(user.units);
    }
  }
  
  /**
   * Update user's plate inventory
   */
  static updatePlateInventory(id, plateInventory) {
    try {
      // Validate and stringify the inventory
      const inventoryString = JSON.stringify(plateInventory);
      
      // Extract bar_weight if present
      const barWeight = plateInventory.bar_weight || null;
      
      // Update both plate_inventory and bar_weight
      run(
        'UPDATE users SET plate_inventory = ?, bar_weight = ? WHERE id = ?',
        [inventoryString, barWeight, id]
      );
      
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