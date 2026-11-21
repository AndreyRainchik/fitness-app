import { get, all, run } from '../config/database.js';
import { encryptSecret, decryptSecret } from '../utils/secretBox.js';

/**
 * A user's Strava connection. Tokens are stored encrypted and never returned
 * to the browser.
 */
export class StravaConnection {
  static find(userId) {
    return get('SELECT * FROM strava_connections WHERE user_id = ?', [userId]);
  }

  static findByAthlete(athleteId) {
    return get('SELECT * FROM strava_connections WHERE athlete_id = ?', [String(athleteId)]);
  }

  /** Save (or replace) the connection after the user authorizes the app. */
  static save(userId, { athleteId, athleteName, accessToken, refreshToken, expiresAt, scope }) {
    const existing = this.find(userId);
    const sameAthlete = existing && existing.athlete_id === String(athleteId);
    run('DELETE FROM strava_connections WHERE user_id = ?', [userId]);
    run(
      `INSERT INTO strava_connections (user_id, athlete_id, athlete_name, access_token_encrypted, refresh_token_encrypted,
         expires_at, scope, last_synced_at, last_activity_epoch, backfill_before, backfill_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, String(athleteId), athleteName ?? null, encryptSecret(accessToken), encryptSecret(refreshToken),
        expiresAt, scope ?? null,
        // Reconnecting the same Strava account keeps the sync progress
        sameAthlete ? existing.last_synced_at : null,
        sameAthlete ? existing.last_activity_epoch : null,
        sameAthlete ? existing.backfill_before : null,
        sameAthlete ? existing.backfill_done : 0,
      ]
    );
  }

  /** { accessToken, refreshToken, expiresAt }, or null when missing or unreadable. */
  static tokens(userId) {
    const row = this.find(userId);
    if (!row) return null;
    const accessToken = decryptSecret(row.access_token_encrypted);
    const refreshToken = decryptSecret(row.refresh_token_encrypted);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken, expiresAt: row.expires_at };
  }

  static updateTokens(userId, { accessToken, refreshToken, expiresAt }) {
    run(
      'UPDATE strava_connections SET access_token_encrypted = ?, refresh_token_encrypted = ?, expires_at = ? WHERE user_id = ?',
      [encryptSecret(accessToken), encryptSecret(refreshToken), expiresAt, userId]
    );
  }

  /** Record sync progress. Only the given fields change. */
  static updateProgress(userId, fields) {
    const columns = ['last_synced_at', 'last_activity_epoch', 'backfill_before', 'backfill_done'];
    const sets = columns.filter((c) => fields[c] !== undefined);
    if (!sets.length) return;
    run(
      `UPDATE strava_connections SET ${sets.map((c) => `${c} = ?`).join(', ')} WHERE user_id = ?`,
      [...sets.map((c) => fields[c]), userId]
    );
  }

  static remove(userId) {
    run('DELETE FROM strava_connections WHERE user_id = ?', [userId]);
  }

  /** What the browser may see. */
  static status(userId) {
    const row = this.find(userId);
    if (!row) return { connected: false };
    const counts = Object.fromEntries(
      all('SELECT outcome, COUNT(*) as n FROM strava_activities WHERE user_id = ? GROUP BY outcome', [userId])
        .map((r) => [r.outcome, r.n])
    );
    return {
      connected: true,
      athlete_name: row.athlete_name,
      athlete_id: row.athlete_id,
      last_synced_at: row.last_synced_at,
      connected_at: row.connected_at,
      history_imported: row.backfill_done === 1,
      history_reached: row.backfill_before ? new Date(row.backfill_before * 1000).toISOString().slice(0, 10) : null,
      tokens_readable: this.tokens(userId) !== null,
      counts: {
        cardio: counts.cardio ?? 0,
        strength_linked: counts.strength_linked ?? 0,
        strength_unmatched: counts.strength_unmatched ?? 0,
        ignored: counts.ignored ?? 0,
      },
    };
  }
}

/**
 * The ledger of Strava activities seen and what became of each (see the
 * strava_activities table in config/database.js).
 */
export class StravaActivities {
  static find(userId, activityId) {
    return get('SELECT * FROM strava_activities WHERE user_id = ? AND activity_id = ?', [userId, String(activityId)]);
  }

  /** Insert or replace the ledger row for an activity. */
  static record(userId, activity) {
    run('DELETE FROM strava_activities WHERE user_id = ? AND activity_id = ?', [userId, String(activity.activity_id)]);
    run(
      `INSERT INTO strava_activities (user_id, activity_id, sport_type, name, start_date, start_date_local, elapsed_s,
         avg_hr, max_hr, calories, outcome, workout_id, detailed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, String(activity.activity_id), activity.sport_type ?? null, activity.name ?? null,
        activity.start_date ?? null, activity.start_date_local ?? null, activity.elapsed_s ?? null,
        activity.avg_hr ?? null, activity.max_hr ?? null, activity.calories ?? null,
        activity.outcome, activity.workout_id ?? null, activity.detailed ? 1 : 0, new Date().toISOString(),
      ]
    );
  }

  static remove(userId, activityId) {
    run('DELETE FROM strava_activities WHERE user_id = ? AND activity_id = ?', [userId, String(activityId)]);
  }

  /** The Strava activity a workout came from or was linked to, or null. */
  static forWorkout(workoutId) {
    return get(
      `SELECT activity_id, sport_type, outcome FROM strava_activities
       WHERE workout_id = ? AND outcome IN ('cardio', 'strength_linked')`,
      [workoutId]
    );
  }

  /** Ids of workouts that already have a Strava activity. */
  static linkedWorkoutIds(userId) {
    return new Set(
      all(
        `SELECT workout_id FROM strava_activities WHERE user_id = ? AND workout_id IS NOT NULL
           AND outcome IN ('cardio', 'strength_linked')`,
        [userId]
      ).map((r) => r.workout_id)
    );
  }

  static unmatchedStrength(userId) {
    return all(
      `SELECT * FROM strava_activities WHERE user_id = ? AND outcome = 'strength_unmatched' ORDER BY start_date DESC`,
      [userId]
    );
  }

  /**
   * A workout was deleted here. A cardio session imported from Strava is
   * marked dismissed so the next sync doesn't bring it back; a lifting
   * session goes back to unmatched so it can link to a re-imported workout.
   */
  static workoutDeleted(workoutId) {
    run(
      `UPDATE strava_activities
       SET outcome = CASE outcome WHEN 'cardio' THEN 'dismissed' ELSE 'strength_unmatched' END, workout_id = NULL
       WHERE workout_id = ?`,
      [workoutId]
    );
  }
}
