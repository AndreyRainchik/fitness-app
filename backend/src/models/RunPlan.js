import { get, all, run, insert, transaction } from '../config/database.js';
import { sessionById } from '../services/runSessions.js';

const parseJson = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};

const day = (value) => (value ? String(value).slice(0, 10) : value);

function planRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    race: row.kind === 'race' ? { key: row.race_key, name: row.race_name, date: day(row.race_date), goal_s: row.goal_s } : null,
    vdot: row.vdot,
    vdot_source: row.vdot_source,
    runs_per_week: row.runs_per_week,
    long_run_weekday: row.long_run_weekday,
    unit: row.unit,
    start_date: day(row.start_date),
    end_date: day(row.end_date),
    settings: parseJson(row.settings_json, {}),
    warnings: parseJson(row.warnings_json, []),
    created_at: row.created_at,
  };
}

function runRow(row) {
  const session = sessionById(row.session_id);
  return {
    id: row.id,
    plan_id: row.plan_id,
    date: day(row.date),
    week_index: row.week_index,
    phase: row.phase,
    cutback: !!row.cutback,
    role: row.role,
    session_id: row.session_id,
    family: row.family,
    level: row.level,
    title: row.title,
    purpose: session?.purpose ?? null,
    cue: session?.cue ?? null,
    key: !!row.key_session,
    optional: !!row.optional,
    steps: parseJson(row.steps_json, []),
    distance_m: row.distance_m,
    status: row.status,
    workout_id: row.workout_id,
  };
}

/**
 * Run plans and their planned runs. A user has at most one active plan:
 * saving a new one cancels the old one, keeping its past runs for history.
 */
export default class RunPlan {
  static active(userId) {
    return planRow(get("SELECT * FROM run_plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [userId]));
  }

  static findById(id) {
    const row = get('SELECT * FROM run_plans WHERE id = ?', [id]);
    return row ? { ...planRow(row), user_id: row.user_id } : null;
  }

  /** Save a generated plan (see services/runPlan.generatePlan) as the user's active plan. */
  static create(userId, plan, { vdotSource = null, raceName = null, runsPerWeek, settings = {}, today }) {
    const id = transaction(() => {
      this.cancelActive(userId, today);
      const planId = insert(
        `INSERT INTO run_plans (user_id, kind, race_key, race_name, race_date, goal_s, vdot, vdot_source,
           runs_per_week, long_run_weekday, unit, start_date, end_date, settings_json, warnings_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, plan.kind, plan.race?.key ?? null, raceName, plan.race?.date ?? null, plan.race?.goal_s ?? null,
          plan.vdot, vdotSource, runsPerWeek, plan.long_run_weekday, plan.unit, plan.start_date, plan.end_date,
          JSON.stringify(settings), JSON.stringify(plan.warnings ?? []),
        ]
      );
      for (const week of plan.weeks) {
        for (const r of week.runs) {
          run(
            `INSERT INTO planned_runs (plan_id, date, week_index, phase, cutback, role, session_id, family, level,
               title, key_session, optional, steps_json, distance_m)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [planId, r.date, week.index, week.phase, week.cutback ? 1 : 0, r.role, r.session_id, r.family, r.level,
              r.title, r.key ? 1 : 0, r.optional ? 1 : 0, JSON.stringify(r.steps), Math.round(r.distance_m)]
          );
        }
      }
      return planId;
    });
    return this.findById(id);
  }

  /** Cancel the active plan; its runs from today on are removed, earlier ones kept. */
  static cancelActive(userId, today) {
    const active = this.active(userId);
    if (!active) return null;
    transaction(() => {
      run("DELETE FROM planned_runs WHERE plan_id = ? AND date >= ? AND status = 'planned'", [active.id, today]);
      run("UPDATE run_plans SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [active.id]);
    });
    return active.id;
  }

  /** A plan's runs, oldest first. */
  static runs(planId) {
    return all('SELECT * FROM planned_runs WHERE plan_id = ? ORDER BY date ASC, id ASC', [planId]).map(runRow);
  }

  /** The user's planned runs dated [from, to], from any plan (past plans keep their history). */
  static runsBetween(userId, from, to) {
    return all(
      `SELECT pr.* FROM planned_runs pr JOIN run_plans p ON p.id = pr.plan_id
       WHERE p.user_id = ? AND pr.date >= ? AND pr.date <= ?
       ORDER BY pr.date ASC, pr.id ASC`,
      [userId, from, to]
    ).map(runRow);
  }

  /** The plan whose runs these are, by id. */
  static plansById(ids) {
    if (!ids.length) return new Map();
    const rows = all(`SELECT * FROM run_plans WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return new Map(rows.map((r) => [r.id, planRow(r)]));
  }
}
