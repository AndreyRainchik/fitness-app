import { get, all, run } from '../config/database.js';

/**
 * BodyweightLog Model
 * Handles bodyweight tracking over time
 */
class BodyweightLog {
  /**
   * Create a new bodyweight log entry
   */
  static create({ user_id, date, weight, units = 'lbs' }) {
    run(
      `INSERT INTO bodyweight_logs (user_id, date, weight, units)
       VALUES (?, ?, ?, ?)`,
      [user_id, date, weight, units]
    );
    
    // Get the created entry
    return get(
      'SELECT * FROM bodyweight_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );
  }
  
  /**
   * Get bodyweight log by ID
   */
  static findById(id) {
    return get('SELECT * FROM bodyweight_logs WHERE id = ?', [id]);
  }
  
  /**
   * Get all bodyweight logs for a user
   */
  static getByUser(user_id, limit = null) {
    if (limit) {
      return all(
        'SELECT * FROM bodyweight_logs WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?',
        [user_id, limit]
      );
    }
    return all(
      'SELECT * FROM bodyweight_logs WHERE user_id = ? ORDER BY date DESC, id DESC',
      [user_id]
    );
  }
  
  /**
   * Get bodyweight logs for a user within a date range
   */
  static getByUserAndDateRange(user_id, start_date, end_date) {
    return all(
      `SELECT * FROM bodyweight_logs 
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [user_id, start_date, end_date]
    );
  }
  
  /**
   * Get most recent bodyweight for a user
   */
  static getLatest(user_id) {
    return get(
      'SELECT * FROM bodyweight_logs WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1',
      [user_id]
    );
  }
  
  /**
   * Get bodyweight at or before a specific date
   */
  static getAtDate(user_id, date) {
    return get(
      'SELECT * FROM bodyweight_logs WHERE user_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1',
      [user_id, date]
    );
  }
  
  /**
   * Update bodyweight log
   */
  static update(id, { date, weight, units }) {
    const updates = [];
    const params = [];
    
    if (date !== undefined) {
      updates.push('date = ?');
      params.push(date);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      params.push(weight);
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
      `UPDATE bodyweight_logs SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete bodyweight log
   */
  static delete(id) {
    run('DELETE FROM bodyweight_logs WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Get bodyweight trend (average over time periods)
   */
  static getTrend(user_id, days = 30) {
    // Get average bodyweight for each week in the specified period
    return all(
      `SELECT 
        date(date, '-' || (julianday(date) - julianday((SELECT MIN(date) FROM bodyweight_logs WHERE user_id = ?))) % 7 || ' days') as week_start,
        AVG(weight) as avg_weight,
        MIN(weight) as min_weight,
        MAX(weight) as max_weight,
        COUNT(*) as entries,
        units
       FROM bodyweight_logs
       WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
       GROUP BY week_start, units
       ORDER BY week_start ASC`,
      [user_id, user_id, days]
    );
  }
}

export default BodyweightLog;