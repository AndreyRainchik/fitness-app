import { get, all, run } from '../config/database.js';
import { CARDIO_LIST_COLUMNS, CARDIO_LIST_JOINS } from './Cardio.js';

const parseJson = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * The weekly schedule: a slot per weekday (Sunday first), the order the
 * program's lifts fill lifting days, and one-off changes for single dates.
 */
export default class Schedule {
  /** { days: [7] | null, lift_order: [exercise_id] } */
  static get(userId) {
    const row = get('SELECT days_json, lift_order_json FROM weekly_schedules WHERE user_id = ?', [userId]);
    return {
      days: row ? parseJson(row.days_json, null) : null,
      lift_order: row ? parseJson(row.lift_order_json, []) : [],
    };
  }

  static save(userId, { days, lift_order = [] }) {
    run(
      `INSERT INTO weekly_schedules (user_id, days_json, lift_order_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET days_json = excluded.days_json,
         lift_order_json = excluded.lift_order_json, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(days), JSON.stringify(lift_order)]
    );
    return this.get(userId);
  }

  /** Map date -> slot for dates in [from, to] */
  static overrides(userId, from, to) {
    const rows = all(
      'SELECT date, slot FROM schedule_overrides WHERE user_id = ? AND date >= ? AND date <= ?',
      [userId, from, to]
    );
    return new Map(rows.map((r) => [r.date, r.slot]));
  }

  static setOverride(userId, date, slot) {
    run(
      `INSERT INTO schedule_overrides (user_id, date, slot) VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET slot = excluded.slot`,
      [userId, date, slot]
    );
  }

  static clearOverride(userId, date) {
    run('DELETE FROM schedule_overrides WHERE user_id = ? AND date = ?', [userId, date]);
  }

  /**
   * Sessions dated [from, to] with what the week view needs, including the
   * exercises of strength sessions: exercise_ids and exercise_names.
   */
  static sessions(userId, from, to) {
    const rows = all(
      `SELECT w.id, w.date, w.kind, w.name, w.duration_minutes, ${CARDIO_LIST_COLUMNS}
       FROM workouts w ${CARDIO_LIST_JOINS}
       WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
       ORDER BY w.date ASC, w.start_time ASC, w.id ASC`,
      [userId, from, to]
    );
    if (!rows.length) return [];
    const exercises = all(
      // In the order they were done
      `SELECT s.workout_id, e.id as exercise_id, e.name
       FROM sets s JOIN exercises e ON e.id = s.exercise_id
       JOIN workouts w ON w.id = s.workout_id
       WHERE w.user_id = ? AND w.date >= ? AND w.date <= ?
       GROUP BY s.workout_id, e.id
       ORDER BY s.workout_id, MIN(s.id)`,
      [userId, from, to]
    );
    const byWorkout = new Map();
    for (const row of exercises) {
      if (!byWorkout.has(row.workout_id)) byWorkout.set(row.workout_id, { ids: [], names: [] });
      const entry = byWorkout.get(row.workout_id);
      entry.ids.push(Number(row.exercise_id));
      entry.names.push(row.name);
    }
    return rows.map((r) => ({
      ...r,
      date: String(r.date).slice(0, 10),
      exercise_ids: byWorkout.get(r.id)?.ids ?? [],
      exercise_names: byWorkout.get(r.id)?.names ?? [],
    }));
  }
}
