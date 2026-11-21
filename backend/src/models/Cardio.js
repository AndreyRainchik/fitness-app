import { get, all, run, insert, transaction } from '../config/database.js';

export const CARDIO_SPORTS = ['run', 'ride', 'row', 'boulder', 'other'];
export const ENVIRONMENTS = ['indoor', 'outdoor'];

// Sports that cover a distance (bouldering doesn't)
export const DISTANCE_SPORTS = new Set(['run', 'ride', 'row', 'other']);

const METRIC_FIELDS = ['avg_hr', 'max_hr', 'calories'];

/** Columns the history list needs, for joining onto a workouts query. */
export const CARDIO_LIST_COLUMNS = `
  cs.sport, cs.environment, cs.duration_s, cs.distance_m, cs.elevation_gain_m,
  sm.avg_hr, sm.max_hr, sm.calories`;
export const CARDIO_LIST_JOINS = `
  LEFT JOIN cardio_sessions cs ON cs.workout_id = w.id
  LEFT JOIN session_metrics sm ON sm.workout_id = w.id`;

function sessionParams(fields) {
  return [
    fields.sport,
    fields.environment ?? null,
    fields.duration_s,
    DISTANCE_SPORTS.has(fields.sport) ? fields.distance_m ?? null : null,
    fields.elevation_gain_m ?? null,
    fields.avg_cadence ?? null,
  ];
}

/**
 * Insert, replace or remove (when every value is empty) a session's heart
 * rate and calories. Used for strength workouts too.
 */
export function saveMetrics(workoutId, fields) {
  const values = METRIC_FIELDS.map((f) => fields[f] ?? null);
  run('DELETE FROM session_metrics WHERE workout_id = ?', [workoutId]);
  if (values.some((v) => v !== null)) {
    run(
      'INSERT INTO session_metrics (workout_id, avg_hr, max_hr, calories) VALUES (?, ?, ?, ?)',
      [workoutId, ...values]
    );
  }
}

/**
 * Cardio sessions: a `workouts` row (kind 'cardio') plus its cardio_sessions
 * and session_metrics rows.
 *
 * Fields: date, start_time?, name?, notes?, sport, environment?, duration_s,
 * distance_m?, elevation_gain_m?, avg_cadence?, avg_hr?, max_hr?, calories?,
 * summary_polyline?, splits_json? (the last two come from Strava; update()
 * leaves them alone when they're not given, so editing by hand keeps them)
 */
class Cardio {
  static create(userId, fields) {
    const id = transaction(() => {
      const workoutId = insert(
        `INSERT INTO workouts (user_id, kind, date, start_time, name, notes, duration_minutes)
         VALUES (?, 'cardio', ?, ?, ?, ?, ?)`,
        [
          userId, fields.date, fields.start_time ?? null, fields.name ?? null, fields.notes ?? null,
          Math.round(fields.duration_s / 60),
        ]
      );
      run(
        `INSERT INTO cardio_sessions (workout_id, sport, environment, duration_s, distance_m, elevation_gain_m, avg_cadence,
           summary_polyline, splits_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workoutId, ...sessionParams(fields), fields.summary_polyline ?? null, fields.splits_json ?? null]
      );
      saveMetrics(workoutId, fields);
      return workoutId;
    });
    return this.findById(id);
  }

  /** Replace every field of a cardio session. */
  static update(workoutId, fields) {
    transaction(() => {
      run(
        `UPDATE workouts SET date = ?, start_time = ?, name = ?, notes = ?, duration_minutes = ?
         WHERE id = ? AND kind = 'cardio'`,
        [
          fields.date, fields.start_time ?? null, fields.name ?? null, fields.notes ?? null,
          Math.round(fields.duration_s / 60), workoutId,
        ]
      );
      run(
        `UPDATE cardio_sessions SET sport = ?, environment = ?, duration_s = ?, distance_m = ?,
           elevation_gain_m = ?, avg_cadence = ?
         WHERE workout_id = ?`,
        [...sessionParams(fields), workoutId]
      );
      for (const column of ['summary_polyline', 'splits_json']) {
        if (fields[column] !== undefined) {
          run(`UPDATE cardio_sessions SET ${column} = ? WHERE workout_id = ?`, [fields[column], workoutId]);
        }
      }
      saveMetrics(workoutId, fields);
    });
    return this.findById(workoutId);
  }

  /** The workout row with `cardio` and `metrics` attached (either may be null). */
  static findById(workoutId) {
    const workout = get('SELECT * FROM workouts WHERE id = ?', [workoutId]);
    if (!workout) return null;
    return { ...workout, ...this.detailsFor(workoutId) };
  }

  static detailsFor(workoutId) {
    return {
      cardio: get('SELECT * FROM cardio_sessions WHERE workout_id = ?', [workoutId]),
      metrics: get('SELECT * FROM session_metrics WHERE workout_id = ?', [workoutId]),
    };
  }

  /** Remove a workout's cardio and metrics rows (foreign-key cascades are off in sql.js). */
  static deleteDetails(workoutId) {
    run('DELETE FROM cardio_sessions WHERE workout_id = ?', [workoutId]);
    run('DELETE FROM session_metrics WHERE workout_id = ?', [workoutId]);
  }

  /**
   * Every session (strength and cardio) on or after a date, with what the
   * training summary needs.
   */
  static sessionsSince(userId, startDate) {
    return all(
      `SELECT w.id, w.date, w.kind, w.duration_minutes, ${CARDIO_LIST_COLUMNS}
       FROM workouts w ${CARDIO_LIST_JOINS}
       WHERE w.user_id = ? AND w.date >= ?
       ORDER BY w.date ASC, w.id ASC`,
      [userId, startDate]
    );
  }
}

export default Cardio;
