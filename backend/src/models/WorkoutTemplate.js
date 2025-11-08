import { getDatabase, saveDatabase } from '../config/database.js';

/**
 * WorkoutTemplate model
 * Manages workout templates (reusable workout structures)
 */
class WorkoutTemplate {
  /**
   * Create a new workout template
   */
  static create({ user_id, name, description = null }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO workout_templates (user_id, name, description)
      VALUES (?, ?, ?)
    `);
    
    stmt.run([user_id, name, description]);
    const templateId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    stmt.free();
    saveDatabase();
    
    return this.findById(templateId);
  }

  /**
   * Find template by ID
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM workout_templates WHERE id = ?
    `);
    
    stmt.bind([id]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    
    return result;
  }

  /**
   * Get all templates for a user
   */
  static getByUser(userId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        wt.*,
        COUNT(DISTINCT ts.exercise_id) as exercise_count,
        COUNT(ts.id) as total_sets
      FROM workout_templates wt
      LEFT JOIN template_sets ts ON wt.id = ts.template_id
      WHERE wt.user_id = ?
      GROUP BY wt.id
      ORDER BY wt.created_at DESC
    `);
    
    stmt.bind([userId]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }

  /**
   * Get template with all sets and exercise details
   */
  static getWithDetails(id) {
    const template = this.findById(id);
    if (!template) return null;

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        ts.*,
        e.name as exercise_name,
        e.primary_muscle_group,
        e.category
      FROM template_sets ts
      JOIN exercises e ON ts.exercise_id = e.id
      WHERE ts.template_id = ?
      ORDER BY ts.id
    `);
    
    stmt.bind([id]);
    const sets = [];
    while (stmt.step()) {
      sets.push(stmt.getAsObject());
    }
    stmt.free();
    
    return {
      ...template,
      sets
    };
  }

  /**
   * Update template
   */
  static update(id, { name, description }) {
    const db = getDatabase();
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    
    if (updates.length === 0) return this.findById(id);
    
    values.push(id);
    const stmt = db.prepare(`
      UPDATE workout_templates 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(values);
    stmt.free();
    saveDatabase();
    
    return this.findById(id);
  }

  /**
   * Delete template
   */
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM workout_templates WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
    
    return true;
  }

  /**
   * Create a workout from this template
   */
  static createWorkoutFromTemplate(templateId, userId, workoutDate) {
    const template = this.getWithDetails(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Verify the template belongs to the user
    if (template.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    const db = getDatabase();
    
    // Create workout
    const workoutStmt = db.prepare(`
      INSERT INTO workouts (user_id, date, name)
      VALUES (?, ?, ?)
    `);
    
    workoutStmt.run([userId, workoutDate, template.name]);
    const workoutId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    workoutStmt.free();

    // Copy all template sets to workout sets
    const setStmt = db.prepare(`
      INSERT INTO sets (workout_id, exercise_id, set_number, reps, weight, rpe, is_warmup, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    template.sets.forEach(set => {
      setStmt.run([
        workoutId,
        set.exercise_id,
        set.set_number,
        set.reps,
        set.weight,
        set.rpe,
        set.is_warmup,
        set.notes
      ]);
    });

    setStmt.free();
    saveDatabase();

    return workoutId;
  }
}

/**
 * TemplateSet model
 * Manages individual sets within a template
 */
class TemplateSet {
  /**
   * Create a new template set
   */
  static create({ template_id, exercise_id, set_number, reps, weight, rpe = null, is_warmup = 0, notes = null }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO template_sets (template_id, exercise_id, set_number, reps, weight, rpe, is_warmup, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([template_id, exercise_id, set_number, reps, weight, rpe, is_warmup, notes]);
    const setId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    stmt.free();
    saveDatabase();
    
    return this.findById(setId);
  }

  /**
   * Find set by ID
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM template_sets WHERE id = ?');
    stmt.bind([id]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  }

  /**
   * Update set
   */
  static update(id, { set_number, reps, weight, rpe, is_warmup, notes }) {
    const db = getDatabase();
    const updates = [];
    const values = [];
    
    if (set_number !== undefined) {
      updates.push('set_number = ?');
      values.push(set_number);
    }
    if (reps !== undefined) {
      updates.push('reps = ?');
      values.push(reps);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      values.push(weight);
    }
    if (rpe !== undefined) {
      updates.push('rpe = ?');
      values.push(rpe);
    }
    if (is_warmup !== undefined) {
      updates.push('is_warmup = ?');
      values.push(is_warmup ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    
    if (updates.length === 0) return this.findById(id);
    
    values.push(id);
    const stmt = db.prepare(`
      UPDATE template_sets 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(values);
    stmt.free();
    saveDatabase();
    
    return this.findById(id);
  }

  /**
   * Delete set
   */
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM template_sets WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
    return true;
  }

  /**
   * Get all sets for a template
   */
  static getByTemplate(templateId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        ts.*,
        e.name as exercise_name
      FROM template_sets ts
      JOIN exercises e ON ts.exercise_id = e.id
      WHERE ts.template_id = ?
      ORDER BY ts.exercise_id, ts.set_number
    `);
    
    stmt.bind([templateId]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }
}

export { WorkoutTemplate, TemplateSet };