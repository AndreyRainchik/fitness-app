import { get, all, run, insert, transaction } from '../config/database.js';

const SET_COLUMNS = '(workout_id, exercise_id, set_number, reps, weight, rpe, is_warmup, notes)';

function setParams(workout_id, set) {
  return [
    workout_id,
    set.exercise_id,
    set.set_number,
    set.reps,
    set.weight,
    set.rpe ?? null,
    set.is_warmup ? 1 : 0,
    set.notes ?? null
  ];
}

/**
 * Workout Model
 * Handles workout session management
 */
class Workout {
  /**
   * Create a new workout
   */
  static create({ user_id, date, name = null, notes = null, duration_minutes = null }) {
    const id = insert(
      `INSERT INTO workouts (user_id, date, name, notes, duration_minutes)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, date, name, notes, duration_minutes]
    );
    return this.findById(id);
  }

  /**
   * Create a workout and all of its sets in one transaction (one disk write).
   * sets: [{ exercise_id, set_number, reps, weight, rpe?, is_warmup?, notes? }]
   */
  static createWithSets(workoutData, sets = []) {
    const id = transaction(() => {
      const workout = this.create(workoutData);
      for (const set of sets) {
        run(`INSERT INTO sets ${SET_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, setParams(workout.id, set));
      }
      return workout.id;
    });
    return this.getWithDetails(id);
  }

  /**
   * Update a workout's fields and make its sets match `sets` exactly, in one
   * transaction. Sets with an `id` belonging to this workout are updated in
   * place (keeping their ids); sets without one are inserted; existing sets not
   * in the list are deleted.
   */
  static updateWithSets(id, workoutFields, sets = []) {
    transaction(() => {
      this.update(id, workoutFields);

      const existingIds = new globalThis.Set(
        all('SELECT id FROM sets WHERE workout_id = ?', [id]).map(row => row.id)
      );
      const keptIds = new globalThis.Set();

      for (const set of sets) {
        if (set.id && existingIds.has(set.id)) {
          keptIds.add(set.id);
          run(
            `UPDATE sets SET exercise_id = ?, set_number = ?, reps = ?, weight = ?, rpe = ?, is_warmup = ?, notes = ?
             WHERE id = ?`,
            [...setParams(id, set).slice(1), set.id]
          );
        } else {
          run(`INSERT INTO sets ${SET_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, setParams(id, set));
        }
      }

      for (const existingId of existingIds) {
        if (!keptIds.has(existingId)) {
          run('DELETE FROM sets WHERE id = ?', [existingId]);
        }
      }
    });
    return this.getWithDetails(id);
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
    if (workouts.length === 0) {
      return workouts;
    }

    // One query per chunk of workouts instead of one query per workout
    const namesByWorkout = new Map();
    const CHUNK = 500;
    for (let i = 0; i < workouts.length; i += CHUNK) {
      const ids = workouts.slice(i, i + CHUNK).map(w => w.id);
      const rows = all(
        `SELECT DISTINCT s.workout_id, e.name
         FROM sets s
         JOIN exercises e ON s.exercise_id = e.id
         WHERE s.workout_id IN (${ids.map(() => '?').join(',')})
         ORDER BY e.name`,
        ids
      );
      for (const row of rows) {
        if (!namesByWorkout.has(row.workout_id)) {
          namesByWorkout.set(row.workout_id, []);
        }
        namesByWorkout.get(row.workout_id).push({ name: row.name });
      }
    }

    return workouts.map(workout => ({
      ...workout,
      exercises: namesByWorkout.get(workout.id) || []
    }));
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