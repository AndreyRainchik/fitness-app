import { get, all, run } from '../config/database.js';
import { encryptSecret, decryptSecret } from '../utils/secretBox.js';

/**
 * A user's Hevy connection. The API key is stored encrypted and never
 * returned to the browser; only its last four characters are.
 */
export class HevyConnection {
  static find(user_id) {
    return get('SELECT * FROM hevy_connections WHERE user_id = ?', [user_id]);
  }

  /** What the browser may see about the connection. */
  static status(user_id) {
    const row = this.find(user_id);
    if (!row) return { connected: false };
    return {
      connected: true,
      key_hint: row.key_hint,
      hevy_username: row.hevy_username,
      last_synced_at: row.last_synced_at,
      connected_at: row.connected_at,
      // False when the server's encryption key changed since the key was saved
      key_readable: decryptSecret(row.api_key_encrypted) !== null,
    };
  }

  /** The decrypted API key, or null. */
  static apiKey(user_id) {
    const row = this.find(user_id);
    return row ? decryptSecret(row.api_key_encrypted) : null;
  }

  static save(user_id, apiKey, hevyUsername = null) {
    const encrypted = encryptSecret(apiKey);
    const hint = apiKey.slice(-4);
    if (this.find(user_id)) {
      run(
        `UPDATE hevy_connections SET api_key_encrypted = ?, key_hint = ?, hevy_username = ?, connected_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [encrypted, hint, hevyUsername, user_id]
      );
    } else {
      run(
        'INSERT INTO hevy_connections (user_id, api_key_encrypted, key_hint, hevy_username) VALUES (?, ?, ?, ?)',
        [user_id, encrypted, hint, hevyUsername]
      );
    }
    return this.status(user_id);
  }

  static setLastSynced(user_id, timestamp) {
    run('UPDATE hevy_connections SET last_synced_at = ? WHERE user_id = ?', [timestamp, user_id]);
  }

  static remove(user_id) {
    run('DELETE FROM hevy_connections WHERE user_id = ?', [user_id]);
  }
}

/** The exercise a user picked for each Hevy exercise template. */
export class HevyExerciseMapping {
  /** Map of hevy_template_id -> { exercise_id, exercise_name } */
  static getForUser(user_id) {
    const rows = all(
      `SELECT m.hevy_template_id, m.exercise_id, e.name AS exercise_name
       FROM hevy_exercise_mappings m
       JOIN exercises e ON e.id = m.exercise_id
       WHERE m.user_id = ?`,
      [user_id]
    );
    return new Map(rows.map((r) => [r.hevy_template_id, r]));
  }

  static upsert(user_id, hevy_template_id, hevy_title, exercise_id) {
    run(
      `INSERT INTO hevy_exercise_mappings (user_id, hevy_template_id, hevy_title, exercise_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, hevy_template_id)
       DO UPDATE SET exercise_id = excluded.exercise_id, hevy_title = excluded.hevy_title, updated_at = CURRENT_TIMESTAMP`,
      [user_id, hevy_template_id, hevy_title, exercise_id]
    );
  }
}

/** Workouts that were imported from Hevy. */
export class HevyImportedWorkouts {
  /** Map of hevy_workout_id -> { id, hevy_updated_at } for the given Hevy ids. */
  static findByHevyIds(user_id, hevyIds) {
    if (hevyIds.length === 0) return new Map();
    const placeholders = hevyIds.map(() => '?').join(', ');
    const rows = all(
      `SELECT id, hevy_workout_id, hevy_updated_at FROM workouts
       WHERE user_id = ? AND hevy_workout_id IN (${placeholders})
       ORDER BY id`,
      [user_id, ...hevyIds]
    );
    return new Map(rows.map((r) => [r.hevy_workout_id, r]));
  }

  static markImported(workout_id, hevy_workout_id, hevy_updated_at) {
    run('UPDATE workouts SET hevy_workout_id = ?, hevy_updated_at = ? WHERE id = ?', [hevy_workout_id, hevy_updated_at, workout_id]);
  }
}
