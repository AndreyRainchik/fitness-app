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
  static async create({ email, password, username, bodyweight = null, units = 'kg' }) {
    try {
      // Hash password
      const password_hash = await bcrypt.hash(password, 10);
      
      // Insert user
      run(
        `INSERT INTO users (email, password_hash, username, bodyweight, units)
         VALUES (?, ?, ?, ?, ?)`,
        [email, password_hash, username, bodyweight, units]
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
   * Update user profile
   */
  static update(id, { username, bodyweight, units }) {
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
    const users = all('SELECT id, email, username, bodyweight, units, created_at FROM users');
    return users;
  }
}

export default User;