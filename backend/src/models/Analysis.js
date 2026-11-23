import { get, all, run, transaction } from '../config/database.js';

/** Per-session analysis of second-by-second data (see session_analysis in config/database.js). */
export class SessionAnalysis {
  static find(workoutId) {
    return get('SELECT * FROM session_analysis WHERE workout_id = ?', [workoutId]);
  }

  /** Record a session's analysis: its HR histogram and best efforts ({ key: seconds }). */
  static save(workoutId, { histogram, efforts = {} }) {
    transaction(() => {
      run('DELETE FROM session_analysis WHERE workout_id = ?', [workoutId]);
      run(
        `INSERT INTO session_analysis (workout_id, status, hr_histogram, updated_at) VALUES (?, 'ok', ?, ?)`,
        [workoutId, histogram ? JSON.stringify(histogram) : null, new Date().toISOString()]
      );
      run('DELETE FROM best_efforts WHERE workout_id = ?', [workoutId]);
      for (const [key, seconds] of Object.entries(efforts)) {
        run('INSERT INTO best_efforts (workout_id, effort_key, seconds) VALUES (?, ?, ?)', [workoutId, key, seconds]);
      }
    });
  }

  /** The source has no detailed data for this session: don't ask again. */
  static markNone(workoutId) {
    transaction(() => {
      run('DELETE FROM session_analysis WHERE workout_id = ?', [workoutId]);
      run(`INSERT INTO session_analysis (workout_id, status, updated_at) VALUES (?, 'none', ?)`, [workoutId, new Date().toISOString()]);
    });
  }

  static remove(workoutId) {
    transaction(() => {
      run('DELETE FROM session_analysis WHERE workout_id = ?', [workoutId]);
      run('DELETE FROM best_efforts WHERE workout_id = ?', [workoutId]);
    });
  }

  /**
   * Sessions from a date on with their HR histogram (null when there's
   * none): [{ workout_id, date, kind, sport, avg_hr, duration_s, histogram }].
   */
  static sessionsSince(userId, startDate) {
    return all(
      `SELECT w.id as workout_id, w.date, w.kind, w.duration_minutes, cs.sport, cs.duration_s, sm.avg_hr, sa.hr_histogram
       FROM workouts w
       LEFT JOIN cardio_sessions cs ON cs.workout_id = w.id
       LEFT JOIN session_metrics sm ON sm.workout_id = w.id
       LEFT JOIN session_analysis sa ON sa.workout_id = w.id
       WHERE w.user_id = ? AND w.date >= ?
       ORDER BY w.date ASC`,
      [userId, startDate]
    ).map(({ hr_histogram: raw, ...row }) => ({ ...row, histogram: raw ? JSON.parse(raw) : null }));
  }
}

export class BestEfforts {
  static forWorkout(workoutId) {
    return all('SELECT effort_key, seconds FROM best_efforts WHERE workout_id = ?', [workoutId]);
  }

  /** Every best effort of the user's: [{ workout_id, effort_key, seconds, date, name }]. */
  static forUser(userId) {
    return all(
      `SELECT be.workout_id, be.effort_key, be.seconds, w.date, w.name
       FROM best_efforts be JOIN workouts w ON w.id = be.workout_id
       WHERE w.user_id = ?
       ORDER BY w.date ASC`,
      [userId]
    );
  }
}

/** Dated heart rate settings (max HR, optional resting HR). */
export class AthleteThresholds {
  static list(userId) {
    return all(
      'SELECT id, effective_date, max_hr, resting_hr FROM athlete_thresholds WHERE user_id = ? ORDER BY effective_date DESC',
      [userId]
    );
  }

  /** Add settings for a date, replacing any already on that date. */
  static save(userId, { effective_date: date, max_hr: max, resting_hr: rest }) {
    transaction(() => {
      run('DELETE FROM athlete_thresholds WHERE user_id = ? AND effective_date = ?', [userId, date]);
      run(
        'INSERT INTO athlete_thresholds (user_id, effective_date, max_hr, resting_hr) VALUES (?, ?, ?, ?)',
        [userId, date, max, rest ?? null]
      );
    });
    return this.list(userId);
  }

  static remove(userId, id) {
    run('DELETE FROM athlete_thresholds WHERE user_id = ? AND id = ?', [userId, id]);
    return this.list(userId);
  }

  /** The highest heart rate recorded in a session since a date: { max_hr, date, workout_id } or null. */
  static highestSince(userId, startDate) {
    return get(
      `SELECT sm.max_hr, w.date, w.id as workout_id
       FROM session_metrics sm JOIN workouts w ON w.id = sm.workout_id
       WHERE w.user_id = ? AND w.date >= ? AND sm.max_hr BETWEEN 100 AND 230
       ORDER BY sm.max_hr DESC LIMIT 1`,
      [userId, startDate]
    );
  }
}
