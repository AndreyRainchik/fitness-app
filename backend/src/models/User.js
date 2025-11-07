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
  static update(id, { username, bodyweight, units, sex }) {
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
}

export default User;