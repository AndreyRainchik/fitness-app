import { get, all, run } from '../config/database.js';

/**
 * Workout Model
 * Handles workout session management
 */
class Workout {
  /**
   * Create a new workout
   */
  static create({ user_id, date, name = null, notes = null, duration_minutes = null }) {
    run(
      `INSERT INTO workouts (user_id, date, name, notes, duration_minutes)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, date, name, notes, duration_minutes]
    );
    
    // Get the created workout
    return get(
      'SELECT * FROM workouts WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );
  }
  
  /**
   * Get workout by ID
   */
  static findById(id) {
    return get('SELECT * FROM workouts WHERE id = ?', [id]);
  }
  
  /**
   * Get all workouts for a user WITH summary data (exercise count, volume, exercise names)
   */
  static getByUser(user_id, limit = null) {
    let query = `
      SELECT 
        w.*,
        COUNT(DISTINCT s.exercise_id) as exercise_count,
        SUM(s.weight * s.reps) as total_volume
      FROM workouts w
      LEFT JOIN sets s ON w.id = s.workout_id
      WHERE w.user_id = ?
      GROUP BY w.id
      ORDER BY w.date DESC, w.id DESC
    `;
    
    if (limit) {
      query += ' LIMIT ?';
      const workouts = all(query, [user_id, limit]);
      return this._enrichWorkoutsWithExercises(workouts);
    }
    
    const workouts = all(query, [user_id]);
    return this._enrichWorkoutsWithExercises(workouts);
  }
  
  /**
   * Helper: Add exercise names to workouts
   */
  static _enrichWorkoutsWithExercises(workouts) {
    return workouts.map(workout => {
      // Get unique exercises for this workout
      const exercises = all(
        `SELECT DISTINCT e.name
         FROM sets s
         JOIN exercises e ON s.exercise_id = e.id
         WHERE s.workout_id = ?
         ORDER BY e.name`,
        [workout.id]
      );
      
      return {
        ...workout,
        exercises: exercises.map(ex => ({ name: ex.name }))
      };
    });
  }
  
  /**
   * Get workouts for a user within a date range WITH summary data
   */
  static getByUserAndDateRange(user_id, start_date, end_date) {
    const workouts = all(
      `SELECT 
        w.*,
        COUNT(DISTINCT s.exercise_id) as exercise_count,
        SUM(s.weight * s.reps) as total_volume
       FROM workouts w
       LEFT JOIN sets s ON w.id = s.workout_id
       WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
       GROUP BY w.id
       ORDER BY w.date DESC, w.id DESC`,
      [user_id, start_date, end_date]
    );
    
    return this._enrichWorkoutsWithExercises(workouts);
  }
  
  /**
   * Get workout with all sets and exercise details
   */
  static getWithDetails(id) {
    const workout = this.findById(id);
    if (!workout) {
      return null;
    }
    
    // Get all sets for this workout with exercise details
    const sets = all(
      `SELECT 
        s.*,
        e.name as exercise_name,
        e.category,
        e.primary_muscle_group,
        e.secondary_muscle_groups,
        e.is_compound
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       WHERE s.workout_id = ?
       ORDER BY s.id`,
      [id]
    );
    
    workout.sets = sets;
    return workout;
  }
  
  /**
   * Update workout
   */
  static update(id, { date, name, notes, duration_minutes }) {
    const updates = [];
    const params = [];
    
    if (date !== undefined) {
      updates.push('date = ?');
      params.push(date);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      params.push(duration_minutes);
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    run(
      `UPDATE workouts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete workout (cascades to sets)
   */
  static delete(id) {
    run('DELETE FROM workouts WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Get workout count for user
   */
  static getCountByUser(user_id) {
    const result = get(
      'SELECT COUNT(*) as count FROM workouts WHERE user_id = ?',
      [user_id]
    );
    return result.count;
  }
  
  /**
   * Get most recent workout date for user
   */
  static getLastWorkoutDate(user_id) {
    const result = get(
      'SELECT MAX(date) as last_date FROM workouts WHERE user_id = ?',
      [user_id]
    );
    return result.last_date;
  }
}

export default Workout;