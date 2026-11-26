import { get, run } from '../config/database.js';
import { encryptSecret, decryptSecret } from '../utils/secretBox.js';

/**
 * A user's AI provider key, used by the AI coach. Stored encrypted and never
 * returned to the browser; only its last four characters are.
 */
export class AiConnection {
  static find(user_id) {
    return get('SELECT * FROM ai_connections WHERE user_id = ?', [user_id]);
  }

  /** What the browser may see about the connection. */
  static status(user_id) {
    const row = this.find(user_id);
    if (!row) return { connected: false };
    return {
      connected: true,
      provider: row.provider,
      key_hint: row.key_hint,
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

  static save(user_id, apiKey, provider = 'anthropic') {
    run(
      `INSERT INTO ai_connections (user_id, provider, api_key_encrypted, key_hint) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET provider = excluded.provider, api_key_encrypted = excluded.api_key_encrypted,
         key_hint = excluded.key_hint, connected_at = CURRENT_TIMESTAMP`,
      [user_id, provider, encryptSecret(apiKey), apiKey.slice(-4)]
    );
    return this.status(user_id);
  }

  static remove(user_id) {
    run('DELETE FROM ai_connections WHERE user_id = ?', [user_id]);
  }
}

/** The voice the coach writes in, per user. */
export class CoachStyle {
  static get(user_id) {
    return get('SELECT coach_style FROM users WHERE id = ?', [user_id])?.coach_style || 'normal';
  }

  static set(user_id, style) {
    run('UPDATE users SET coach_style = ? WHERE id = ?', [style, user_id]);
  }
}

/** The Claude model the coach uses, per user. */
export class CoachModel {
  static get(user_id) {
    return get('SELECT coach_model FROM users WHERE id = ?', [user_id])?.coach_model || null;
  }

  static set(user_id, model) {
    run('UPDATE users SET coach_model = ? WHERE id = ?', [model, user_id]);
  }
}

/** The AI coach's feedback on a workout, one per workout. */
export class WorkoutFeedback {
  static find(workout_id) {
    const row = get('SELECT * FROM workout_feedback WHERE workout_id = ?', [workout_id]);
    if (!row) return null;
    let feedback;
    try {
      feedback = JSON.parse(row.feedback);
    } catch {
      return null;
    }
    return { ...row, feedback };
  }

  /** Saves (or replaces) the feedback for a workout. */
  static save({ workout_id, user_id, feedback, model, style, workout_edited_at }) {
    run(
      `INSERT INTO workout_feedback (workout_id, user_id, feedback, model, style, workout_edited_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(workout_id) DO UPDATE SET feedback = excluded.feedback, model = excluded.model, style = excluded.style,
         workout_edited_at = excluded.workout_edited_at, created_at = excluded.created_at`,
      [workout_id, user_id, JSON.stringify(feedback), model, style, workout_edited_at ?? null]
    );
    return this.find(workout_id);
  }
}
