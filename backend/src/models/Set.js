import { get, all, run } from '../config/database.js';

/**
 * Set Model
 * Handles individual exercise set management
 */
class Set {
  /**
   * Create a new set
   */
  static create({ workout_id, exercise_id, set_number, reps, weight, rpe = null, is_warmup = 0, notes = null }) {
    run(
      `INSERT INTO sets (workout_id, exercise_id, set_number, reps, weight, rpe, is_warmup, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [workout_id, exercise_id, set_number, reps, weight, rpe, is_warmup ? 1 : 0, notes]
    );
    
    // Get the created set
    return get(
      'SELECT * FROM sets WHERE workout_id = ? ORDER BY id DESC LIMIT 1',
      [workout_id]
    );
  }
  
  /**
   * Get set by ID
   */
  static findById(id) {
    return get('SELECT * FROM sets WHERE id = ?', [id]);
  }
  
  /**
   * Get all sets for a workout
   */
  static getByWorkout(workout_id) {
    return all(
      `SELECT s.*, e.name as exercise_name, e.primary_muscle_group
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       WHERE s.workout_id = ?
       ORDER BY s.id`,
      [workout_id]
    );
  }
  
  /**
   * Get all sets for a specific exercise
   */
  static getByExercise(exercise_id, user_id = null, limit = null) {
    let query = `
      SELECT s.*, w.date, w.user_id
      FROM sets s
      JOIN workouts w ON s.workout_id = w.id
      WHERE s.exercise_id = ?`;
    
    const params = [exercise_id];
    
    if (user_id) {
      query += ' AND w.user_id = ?';
      params.push(user_id);
    }
    
    query += ' ORDER BY w.date DESC, s.id DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }
    
    return all(query, params);
  }
  
  /**
   * Get personal records (PRs) for an exercise
   */
  static getPersonalRecords(exercise_id, user_id) {
    // Get max weight for any rep range
    const maxWeight = get(
      `SELECT MAX(weight) as max_weight, reps, weight, w.date
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       WHERE s.exercise_id = ? AND w.user_id = ? AND s.is_warmup = 0
       ORDER BY weight DESC
       LIMIT 1`,
      [exercise_id, user_id]
    );
    
    // Get max reps at any weight
    const maxReps = get(
      `SELECT MAX(reps) as max_reps, reps, weight, w.date
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       WHERE s.exercise_id = ? AND w.user_id = ? AND s.is_warmup = 0
       ORDER BY reps DESC
       LIMIT 1`,
      [exercise_id, user_id]
    );
    
    // Get max volume (weight * reps)
    const maxVolume = get(
      `SELECT (weight * reps) as volume, reps, weight, w.date
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       WHERE s.exercise_id = ? AND w.user_id = ? AND s.is_warmup = 0
       ORDER BY volume DESC
       LIMIT 1`,
      [exercise_id, user_id]
    );
    
    return {
      max_weight: maxWeight,
      max_reps: maxReps,
      max_volume: maxVolume
    };
  }
  
  /**
   * Update set
   */
  static update(id, { set_number, reps, weight, rpe, is_warmup, notes }) {
    const updates = [];
    const params = [];
    
    if (set_number !== undefined) {
      updates.push('set_number = ?');
      params.push(set_number);
    }
    if (reps !== undefined) {
      updates.push('reps = ?');
      params.push(reps);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      params.push(weight);
    }
    if (rpe !== undefined) {
      updates.push('rpe = ?');
      params.push(rpe);
    }
    if (is_warmup !== undefined) {
      updates.push('is_warmup = ?');
      params.push(is_warmup ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    run(
      `UPDATE sets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete set
   */
  static delete(id) {
    run('DELETE FROM sets WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Get total volume for an exercise (user-specific)
   */
  static getTotalVolume(exercise_id, user_id, start_date = null, end_date = null) {
    let query = `
      SELECT SUM(s.weight * s.reps) as total_volume
      FROM sets s
      JOIN workouts w ON s.workout_id = w.id
      WHERE s.exercise_id = ? AND w.user_id = ? AND s.is_warmup = 0`;
    
    const params = [exercise_id, user_id];
    
    if (start_date && end_date) {
      query += ' AND w.date >= ? AND w.date <= ?';
      params.push(start_date, end_date);
    }
    
    const result = get(query, params);
    return result.total_volume || 0;
  }
}

export default Set;