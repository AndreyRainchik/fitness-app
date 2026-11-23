import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Cardio, Program, User } from '../models/index.js';
import Schedule from '../models/Schedule.js';
import RunPlan from '../models/RunPlan.js';
import { BestEfforts } from '../models/Analysis.js';
import { DAY_MS, formatDay, parseDay } from '../services/cardioStats.js';
import { EFFORT_DISTANCES, bestVdot, vdot as vdotFor } from '../services/cardioAnalysis.js';
import { RACE_DISTANCES, ZONES, paceZones } from '../services/runPaces.js';
import { generatePlan, runningBaseline } from '../services/runPlan.js';
import { normalizeDays, projectLiftDays, weekStartFor } from '../services/weekPlan.js';

const router = express.Router();
router.use(authenticateToken);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value) => DATE.test(value || '') && !Number.isNaN(parseDay(value));
const addDays = (date, n) => formatDay(parseDay(date) + n * DAY_MS);
const todayOf = (req) => {
  const value = req.query.localDate ?? req.body?.localDate;
  return isDate(value) ? value : new Date().toISOString().slice(0, 10);
};
const unitFor = (userId) => (User.findById(userId)?.units === 'kg' ? 'km' : 'mi');

// Distances a recent result can be given for
const RESULT_DISTANCES = {
  '1mi': 1609.344, '5k': 5000, '10k': 10000, half: 21097.5, marathon: 42195,
};
const FITNESS_WINDOW_DAYS = 90;

/** The athlete's current fitness from best efforts in the last 90 days, or null. */
function currentFitness(userId, today) {
  const since = addDays(today, -FITNESS_WINDOW_DAYS);
  const efforts = BestEfforts.forUser(userId).filter((e) => String(e.date).slice(0, 10) >= since);
  const best = bestVdot(efforts);
  if (!best) return null;
  const distance = EFFORT_DISTANCES.find((d) => d.key === best.effort.effort_key);
  return {
    vdot: best.vdot,
    source: `${distance.label} in ${formatSeconds(best.effort.seconds)} on ${String(best.effort.date).slice(0, 10)}`,
    effort: { key: best.effort.effort_key, label: distance.label, seconds: best.effort.seconds, date: String(best.effort.date).slice(0, 10) },
  };
}

function formatSeconds(total) {
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function activeProgram(userId) {
  const active = Program.getActiveByUser(userId);
  if (!active) return null;
  const program = Program.getWithLifts(active.id);
  program.statuses = new Map(Program.getCurrentWeekStatuses(active.id).map((s) => [Number(s.exercise_id), s.status]));
  if (program.week_started_on) program.week_started_on = String(program.week_started_on).slice(0, 10);
  return program;
}

/**
 * Everything the generator needs, from the request body and the user's data.
 * Body: { kind, race: { key, date, goal_s?, name? }, weeks?, runs_per_week, long_run_weekday,
 *         recent_result?: { distance, seconds }, weekly_m?, longest_m?, settings?: { hills } }
 * Returns { input, meta } or { error }.
 */
function planInput(req) {
  const userId = req.user.id;
  const today = todayOf(req);
  const b = req.body ?? {};
  const kind = b.kind === 'maintain' ? 'maintain' : b.kind === 'race' ? 'race' : null;
  if (!kind) return { error: 'kind must be race or maintain' };

  let race = null;
  if (kind === 'race') {
    const key = b.race?.key;
    if (!RACE_DISTANCES[key]) return { error: `Race distance must be one of: ${Object.keys(RACE_DISTANCES).join(', ')}` };
    if (!isDate(b.race?.date)) return { error: 'Race date must be YYYY-MM-DD' };
    const goal = b.race.goal_s == null || b.race.goal_s === '' ? null : Number(b.race.goal_s);
    if (goal != null && !(goal > 0 && goal < 24 * 3600)) return { error: 'Goal time must be under 24 hours' };
    const name = typeof b.race.name === 'string' ? b.race.name.trim().slice(0, 100) || null : null;
    race = { key, date: b.race.date, goal_s: goal, name };
  }

  const runsPerWeek = Number(b.runs_per_week);
  if (!Number.isInteger(runsPerWeek) || runsPerWeek < 3 || runsPerWeek > 6) return { error: 'Runs per week must be 3 to 6' };
  const longRunWeekday = Number(b.long_run_weekday);
  if (!Number.isInteger(longRunWeekday) || longRunWeekday < 0 || longRunWeekday > 6) return { error: 'Long run day must be 0 (Sunday) to 6' };

  // Fitness: a recent result the athlete gives wins over what the app found
  let vdot = null;
  let vdotSource = null;
  if (b.recent_result && b.recent_result.distance) {
    const meters = RESULT_DISTANCES[b.recent_result.distance];
    const seconds = Number(b.recent_result.seconds);
    if (!meters || !(seconds > 0)) return { error: 'Recent result needs a distance (1mi, 5k, 10k, half, marathon) and a time' };
    vdot = Math.round(vdotFor(meters, seconds) * 10) / 10;
    vdotSource = `Your ${b.recent_result.distance === '1mi' ? 'mile' : RACE_DISTANCES[b.recent_result.distance].label} in ${formatSeconds(seconds)}`;
  } else {
    const fitness = currentFitness(userId, today);
    if (fitness) {
      vdot = fitness.vdot;
      vdotSource = `Your best ${fitness.source}`;
    }
  }
  if (!vdot) return { error: 'No recent run shows your current fitness. Enter a recent race or time trial result.', needs_result: true };
  if (vdot < 20 || vdot > 90) return { error: 'That result is outside the range plans are made for.' };

  const sessions = Cardio.sessionsSince(userId, addDays(today, -42)).map((s) => ({ ...s, date: String(s.date).slice(0, 10) }));
  const found = runningBaseline(sessions, today);
  const baseline = {
    weekly_m: b.weekly_m > 0 ? Number(b.weekly_m) : found.weekly_m,
    longest_m: b.longest_m > 0 ? Number(b.longest_m) : found.longest_m,
  };

  const schedule = Schedule.get(userId);
  const days = normalizeDays(schedule.days) ?? ['flex', 'flex', 'flex', 'flex', 'flex', 'flex', 'flex'];
  const until = kind === 'race' ? race.date : addDays(today, 7 * (b.weeks ?? 12) + 7);
  const program = activeProgram(userId);
  const liftSessions = Schedule.sessions(userId, program?.week_started_on && program.week_started_on < weekStartFor(today) ? program.week_started_on : weekStartFor(today), today);
  const projection = projectLiftDays({
    from: today, until, days, overrides: Schedule.overrides(userId, today, until), program,
    liftOrder: schedule.lift_order, sessions: liftSessions, today,
  });

  const settings = { hills: b.settings?.hills !== false };
  return {
    input: {
      kind, race, weeks: Math.min(Math.max(Number(b.weeks) || 12, 4), 24), vdot, baseline,
      runsPerWeek, longRunWeekday, days,
      heavyLegDates: new Set(projection.days.filter((d) => d.heavy_legs).map((d) => d.date)),
      liftDates: new Set(projection.days.map((d) => d.date)),
      deloadWeekStarts: projection.deloadWeekStarts,
      startDate: today, unit: unitFor(userId), settings,
    },
    meta: {
      vdot_source: vdotSource, baseline_found: found, settings, schedule_configured: !!normalizeDays(schedule.days),
      program: program ? { name: program.name, type: program.type } : null,
      lift_days: projection.days,
    },
  };
}

/**
 * GET /api/run-plans/setup?localDate=
 * What the plan wizard shows before the athlete chooses: current fitness, recent
 * running, the schedule's run days, and the active plan if there is one.
 */
router.get('/setup', (req, res) => {
  try {
    const today = todayOf(req);
    const userId = req.user.id;
    const sessions = Cardio.sessionsSince(userId, addDays(today, -42)).map((s) => ({ ...s, date: String(s.date).slice(0, 10) }));
    const schedule = Schedule.get(userId);
    const fitness = currentFitness(userId, today);
    const active = RunPlan.active(userId);
    res.json({
      fitness: fitness && { ...fitness, zones: paceZones(fitness.vdot) },
      baseline: runningBaseline(sessions, today),
      schedule: { days: normalizeDays(schedule.days), configured: !!normalizeDays(schedule.days) },
      unit: unitFor(userId),
      races: Object.entries(RACE_DISTANCES).map(([key, r]) => ({ key, label: r.label, meters: r.meters })),
      active: active && { id: active.id, kind: active.kind, race: active.race, end_date: active.end_date },
    });
  } catch (error) {
    console.error('Run plan setup error:', error);
    res.status(500).json({ error: 'Failed to load plan setup' });
  }
});

/**
 * POST /api/run-plans/preview
 * Generate a plan without saving it. Body as planInput. Returns { plan, meta }.
 */
router.post('/preview', (req, res) => {
  try {
    const { input, meta, error, needs_result: needsResult } = planInput(req);
    if (error) return res.status(400).json({ error, needs_result: !!needsResult });
    const result = generatePlan(input);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ plan: { ...result.plan, vdot_source: meta.vdot_source }, meta, zone_info: ZONES });
  } catch (error) {
    console.error('Run plan preview error:', error);
    res.status(500).json({ error: 'Failed to build the plan' });
  }
});

/**
 * POST /api/run-plans
 * Generate and save the plan, replacing the active one. Body as planInput.
 */
router.post('/', (req, res) => {
  try {
    const { input, meta, error, needs_result: needsResult } = planInput(req);
    if (error) return res.status(400).json({ error, needs_result: !!needsResult });
    const result = generatePlan(input);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const saved = RunPlan.create(req.user.id, result.plan, {
      vdotSource: meta.vdot_source, raceName: input.race?.name ?? null, runsPerWeek: input.runsPerWeek,
      settings: meta.settings, today: input.startDate,
    });
    res.status(201).json({ plan: saved });
  } catch (error) {
    console.error('Run plan save error:', error);
    res.status(500).json({ error: 'Failed to save the plan' });
  }
});

/**
 * GET /api/run-plans/active
 * The active plan with its weeks of runs and its pace zones, or { plan: null }.
 */
router.get('/active', (req, res) => {
  try {
    const plan = RunPlan.active(req.user.id);
    if (!plan) return res.json({ plan: null });
    const runs = RunPlan.runs(plan.id);
    const weeks = new Map();
    for (const r of runs) {
      if (!weeks.has(r.week_index)) {
        weeks.set(r.week_index, { index: r.week_index, week_start: weekStartFor(r.date), phase: r.phase, cutback: r.cutback, total_m: 0, runs: [] });
      }
      const week = weeks.get(r.week_index);
      week.runs.push(r);
      week.total_m += r.distance_m;
    }
    const goalPace = plan.race?.goal_s ? plan.race.goal_s / (RACE_DISTANCES[plan.race.key].meters / 1000) : null;
    res.json({
      plan: { ...plan, race: plan.race && { ...plan.race, label: RACE_DISTANCES[plan.race.key]?.label } },
      zones: paceZones(plan.vdot, { goalPace }),
      zone_info: ZONES,
      weeks: [...weeks.values()].sort((a, b) => a.index - b.index),
    });
  } catch (error) {
    console.error('Active run plan error:', error);
    res.status(500).json({ error: 'Failed to load the plan' });
  }
});

/** DELETE /api/run-plans/active: stop the active plan (runs from today on are removed). */
router.delete('/active', (req, res) => {
  try {
    const id = RunPlan.cancelActive(req.user.id, todayOf(req));
    if (!id) return res.status(404).json({ error: 'No active plan' });
    res.json({ cancelled: id });
  } catch (error) {
    console.error('Cancel run plan error:', error);
    res.status(500).json({ error: 'Failed to stop the plan' });
  }
});

export default router;
