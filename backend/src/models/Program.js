import { get, all, run } from '../config/database.js';

/**
 * Program Model
 * Handles training program management (5/3/1, custom programs, etc.)
 */
class Program {
  /**
   * Create a new program
   */
  static create({ user_id, name, type, start_date, current_week = 1, current_cycle = 1, is_active = 1 }) {
    // Deactivate other programs for this user if this one is active
    if (is_active) {
      run('UPDATE programs SET is_active = 0 WHERE user_id = ?', [user_id]);
    }
    
    run(
      `INSERT INTO programs (user_id, name, type, start_date, current_week, current_cycle, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, name, type, start_date, current_week, current_cycle, is_active ? 1 : 0]
    );
    
    // Get the created program
    return get(
      'SELECT * FROM programs WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );
  }
  
  /**
   * Get program by ID
   */
  static findById(id) {
    return get('SELECT * FROM programs WHERE id = ?', [id]);
  }
  
  /**
   * Get active program for a user
   */
  static getActiveByUser(user_id) {
    return get(
      'SELECT * FROM programs WHERE user_id = ? AND is_active = 1',
      [user_id]
    );
  }
  
  /**
   * Get all programs for a user
   */
  static getByUser(user_id) {
    return all(
      'SELECT * FROM programs WHERE user_id = ? ORDER BY is_active DESC, start_date DESC',
      [user_id]
    );
  }
  
  /**
   * Get program with all lifts
   */
  static getWithLifts(id) {
    const program = this.findById(id);
    if (!program) {
      return null;
    }
    
    const lifts = all(
      `SELECT pl.*, e.name as exercise_name, e.category, e.primary_muscle_group
       FROM program_lifts pl
       JOIN exercises e ON pl.exercise_id = e.id
       WHERE pl.program_id = ?`,
      [id]
    );
    
    program.lifts = lifts;
    return program;
  }
  
  /**
   * Update program
   */
  static update(id, { name, current_week, current_cycle, is_active }) {
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (current_week !== undefined) {
      updates.push('current_week = ?');
      params.push(current_week);
    }
    if (current_cycle !== undefined) {
      updates.push('current_cycle = ?');
      params.push(current_cycle);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
      
      // Deactivate other programs if this one is being activated
      if (is_active) {
        const program = this.findById(id);
        if (program) {
          run(
            'UPDATE programs SET is_active = 0 WHERE user_id = ? AND id != ?',
            [program.user_id, id]
          );
        }
      }
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    run(
      `UPDATE programs SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete program (cascades to program_lifts)
   */
  static delete(id) {
    run('DELETE FROM programs WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Add lift to program
   */
  static addLift(program_id, exercise_id, training_max) {
    run(
      `INSERT INTO program_lifts (program_id, exercise_id, training_max)
       VALUES (?, ?, ?)`,
      [program_id, exercise_id, training_max]
    );
    
    return get(
      'SELECT * FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
  }
  
  /**
   * Update training max for a lift
   */
  static updateLift(program_id, exercise_id, training_max) {
    run(
      `UPDATE program_lifts 
       SET training_max = ?, last_updated = CURRENT_TIMESTAMP 
       WHERE program_id = ? AND exercise_id = ?`,
      [training_max, program_id, exercise_id]
    );
    
    return get(
      'SELECT * FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
  }
  
  /**
   * Get lift from program
   */
  static getLift(program_id, exercise_id) {
    return get(
      `SELECT pl.*, e.name as exercise_name
       FROM program_lifts pl
       JOIN exercises e ON pl.exercise_id = e.id
       WHERE pl.program_id = ? AND pl.exercise_id = ?`,
      [program_id, exercise_id]
    );
  }
  
  /**
   * Remove lift from program
   */
  static removeLift(program_id, exercise_id) {
    run(
      'DELETE FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
    return { success: true };
  }
  
  /**
   * Advance to next week
   */
  static advanceWeek(id) {
    const program = this.findById(id);
    if (!program) {
      return null;
    }
    
    let newWeek = program.current_week + 1;
    let newCycle = program.current_cycle;
    
    // For 5/3/1, cycle through weeks 1-3, then deload (week 4)
    // After week 4, advance to next cycle
    if (program.type === '531') {
      if (newWeek > 4) {
        newWeek = 1;
        newCycle += 1;
      }
    }
    
    return this.update(id, {
      current_week: newWeek,
      current_cycle: newCycle
    });
  }
}

export default Program;