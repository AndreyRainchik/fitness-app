import { get, all, insert, run } from '../config/database.js';

/**
 * Exercise Model
 *
 * The built-in library has user_id NULL and everyone sees it. Custom
 * exercises belong to the user who made them (user_id) and only they see
 * them. Anything that takes an exercise id or name from a request must look
 * it up through the user-scoped methods (findVisible, findVisibleByName,
 * getAll(userId)...); findById is for rows already reached through something
 * the user owns (a set, a template, a program).
 */

export const EXERCISE_CATEGORIES = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'other'];

// Rows a user may see: the shared library plus their own
const VISIBLE = '(user_id IS NULL OR user_id = ?)';

function parse(exercise) {
  if (exercise && typeof exercise.secondary_muscle_groups === 'string') {
    try {
      exercise.secondary_muscle_groups = JSON.parse(exercise.secondary_muscle_groups);
    } catch {
      exercise.secondary_muscle_groups = [];
    }
  }
  return exercise;
}

class Exercise {
  /** Every exercise this user can use. */
  static getAll(userId = null) {
    return all(`SELECT * FROM exercises WHERE ${VISIBLE} ORDER BY name`, [userId]);
  }

  /** Exercise by id, whoever owns it. Only for ids reached through the user's own data. */
  static findById(id) {
    return parse(get('SELECT * FROM exercises WHERE id = ?', [id]));
  }

  /** Exercise by id if this user can use it, else null. */
  static findVisible(id, userId = null) {
    return parse(get(`SELECT * FROM exercises WHERE id = ? AND ${VISIBLE}`, [id, userId]));
  }

  /** An exercise this user can use with this name (any letter case), else null. Their own first. */
  static findVisibleByName(name, userId = null) {
    return parse(get(
      `SELECT * FROM exercises WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND ${VISIBLE}
       ORDER BY user_id IS NULL, id LIMIT 1`,
      [name, userId]
    ));
  }

  static getByCategory(category, userId = null) {
    return all(`SELECT * FROM exercises WHERE category = ? AND ${VISIBLE} ORDER BY name`, [category, userId]);
  }

  static getByMuscleGroup(muscleGroup, userId = null) {
    return all(
      `SELECT * FROM exercises WHERE primary_muscle_group = ? AND ${VISIBLE} ORDER BY is_compound DESC, name`,
      [muscleGroup, userId]
    );
  }

  static getCompoundExercises(userId = null) {
    return all(`SELECT * FROM exercises WHERE is_compound = 1 AND ${VISIBLE} ORDER BY name`, [userId]);
  }

  static getMuscleGroups(userId = null) {
    const groups = all(
      `SELECT DISTINCT primary_muscle_group FROM exercises WHERE ${VISIBLE} ORDER BY primary_muscle_group`,
      [userId]
    );
    return groups.map(g => g.primary_muscle_group);
  }

  /** Name search; the user's own exercises are marked with is_custom. */
  static search(query, userId = null) {
    return all(
      `SELECT *, user_id IS NOT NULL AS is_custom FROM exercises
       WHERE name LIKE ? AND ${VISIBLE}
       ORDER BY name`,
      [`%${query}%`, userId]
    );
  }

  /** Create a custom exercise owned by user_id. */
  static create({ user_id, name, category, primary_muscle_group, secondary_muscle_groups = [], is_compound = 0 }) {
    if (!user_id) throw new Error('Custom exercises need an owner (user_id)');
    const id = insert(
      `INSERT INTO exercises (user_id, name, category, primary_muscle_group, secondary_muscle_groups, is_compound)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, String(name).trim(), category, String(primary_muscle_group).trim(), JSON.stringify(secondary_muscle_groups), is_compound ? 1 : 0]
    );
    return this.findById(id);
  }

  /** Update a custom exercise (built-in ones aren't edited through the API). */
  static update(id, { name, category, primary_muscle_group, secondary_muscle_groups, is_compound }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (primary_muscle_group !== undefined) {
      updates.push('primary_muscle_group = ?');
      params.push(primary_muscle_group);
    }
    if (secondary_muscle_groups !== undefined) {
      updates.push('secondary_muscle_groups = ?');
      params.push(JSON.stringify(secondary_muscle_groups));
    }
    if (is_compound !== undefined) {
      updates.push('is_compound = ?');
      params.push(is_compound ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    run(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
  
  /**
   * Delete exercise
   */
  static delete(id) {
    run('DELETE FROM exercises WHERE id = ?', [id]);
    return { success: true };
  }
}

export default Exercise;