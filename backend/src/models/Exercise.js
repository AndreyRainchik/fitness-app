import { get, all, run } from '../config/database.js';

/**
 * Exercise Model
 * Handles exercise library management
 */
class Exercise {
  /**
   * Get all exercises
   */
  static getAll() {
    return all('SELECT * FROM exercises ORDER BY name');
  }
  
  /**
   * Get exercise by ID
   */
  static findById(id) {
    const exercise = get('SELECT * FROM exercises WHERE id = ?', [id]);
    if (exercise && exercise.secondary_muscle_groups) {
      exercise.secondary_muscle_groups = JSON.parse(exercise.secondary_muscle_groups);
    }
    return exercise;
  }
  
  /**
   * Get exercises by category
   */
  static getByCategory(category) {
    return all('SELECT * FROM exercises WHERE category = ? ORDER BY name', [category]);
  }
  
  /**
   * Get exercises by primary muscle group
   */
  static getByMuscleGroup(muscleGroup) {
    return all(
      'SELECT * FROM exercises WHERE primary_muscle_group = ? ORDER BY is_compound DESC, name',
      [muscleGroup]
    );
  }
  
  /**
   * Get all compound exercises
   */
  static getCompoundExercises() {
    return all('SELECT * FROM exercises WHERE is_compound = 1 ORDER BY name');
  }
  
  /**
   * Get all muscle groups
   */
  static getMuscleGroups() {
    const groups = all('SELECT DISTINCT primary_muscle_group FROM exercises ORDER BY primary_muscle_group');
    return groups.map(g => g.primary_muscle_group);
  }
  
  /**
   * Search exercises by name
   */
  static search(query) {
    return all(
      'SELECT * FROM exercises WHERE name LIKE ? ORDER BY name',
      [`%${query}%`]
    );
  }
  
  /**
   * Create a new exercise (for custom exercises)
   */
  static create({ name, category, primary_muscle_group, secondary_muscle_groups = [], is_compound = 0 }) {
    const secondaryJson = JSON.stringify(secondary_muscle_groups);
    
    run(
      `INSERT INTO exercises (name, category, primary_muscle_group, secondary_muscle_groups, is_compound)
       VALUES (?, ?, ?, ?, ?)`,
      [name, category, primary_muscle_group, secondaryJson, is_compound ? 1 : 0]
    );
    
    // Get the created exercise
    return get('SELECT * FROM exercises WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
  }
  
  /**
   * Update exercise
   */
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
    run(
      `UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
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