import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Program, User } from '../models/index.js';
import Schedule from '../models/Schedule.js';
import { AthleteThresholds, loadSessions } from '../models/Analysis.js';
import { fitnessCurves, formStatus, sessionLoads } from '../services/trainingLoad.js';
import { DAY_MS, formatDay, parseDay } from '../services/cardioStats.js';
import { SLOTS, buildWeek, normalizeDays, weekStartFor } from '../services/weekPlan.js';

const router = express.Router();
router.use(authenticateToken);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value) => DATE.test(value || '') && !Number.isNaN(parseDay(value));
const minDate = (...dates) => dates.filter(Boolean).sort()[0];

/** The user's today: ?localDate= (or body.localDate), else the server's. */
function todayOf(req) {
  const value = req.query.localDate ?? req.body?.localDate;
  return isDate(value) ? value : new Date().toISOString().slice(0, 10);
}

/** The active program with its lifts and this week's statuses, or null. */
function activeProgram(userId) {
  const active = Program.getActiveByUser(userId);
  if (!active) return null;
  const program = Program.getWithLifts(active.id);
  const statuses = Program.getCurrentWeekStatuses(active.id);
  program.statuses = new Map(statuses.map((s) => [Number(s.exercise_id), s.status]));
  if (program.week_started_on) program.week_started_on = String(program.week_started_on).slice(0, 10);
  return program;
}

/** This week's training load next to the 4 weeks before, or null without heart rate settings. */
function weekLoad(userId, weekStart, today) {
  const thresholds = AthleteThresholds.list(userId);
  if (!thresholds.length || weekStart > today) return null;
  const weekEnd = formatDay(parseDay(weekStart) + 6 * DAY_MS);
  const until = minDate(today, weekEnd);
  const sex = User.findById(userId)?.sex ?? null;
  const curves = fitnessCurves(sessionLoads(loadSessions(userId), thresholds, sex), { today: until, weeks: 5 });
  const weekly = curves.weekly.map((w) => w.strength + w.cardio);
  const previous = weekly.slice(0, 4);
  const usual = previous.reduce((a, b) => a + b, 0) / previous.length;
  const day = curves.daily[curves.daily.length - 1];
  return {
    load: Math.round(weekly[4] ?? 0),
    strength: Math.round(curves.weekly[4]?.strength ?? 0),
    cardio: Math.round(curves.weekly[4]?.cardio ?? 0),
    usual: Math.round(usual),
    form: weekStart <= today && today <= weekEnd && day ? { value: day.form, status: formStatus(day.form) } : null,
  };
}

/**
 * GET /api/week?start=YYYY-MM-DD&localDate=YYYY-MM-DD
 * The week containing `start` (default: this week): each day's slot, what's
 * planned on it (program lifts on lifting days, cardio on cardio days) and
 * the sessions done. See services/weekPlan.js.
 */
router.get('/', (req, res) => {
  try {
    const today = todayOf(req);
    const weekStart = weekStartFor(isDate(req.query.start) ? req.query.start : today);
    const weekEnd = formatDay(parseDay(weekStart) + 6 * DAY_MS);
    const schedule = Schedule.get(req.user.id);
    const program = activeProgram(req.user.id);

    // Sessions back to when the program week began, so lifts done for it count
    const from = minDate(weekStart, weekStartFor(today), program?.week_started_on);
    const sessions = Schedule.sessions(req.user.id, from, weekEnd);
    const overrides = Schedule.overrides(req.user.id, minDate(weekStart, today), weekEnd);

    const week = buildWeek({
      weekStart,
      today,
      days: normalizeDays(schedule.days),
      overrides,
      program,
      liftOrder: schedule.lift_order,
      sessions,
    });

    res.json({ ...week, load: weekLoad(req.user.id, weekStart, today) });
  } catch (error) {
    console.error('Week view error:', error);
    res.status(500).json({ error: 'Failed to load the week' });
  }
});

/**
 * GET /api/week/schedule
 * { days: [7 slots, Sunday first] | null, lift_order: [exercise_id], program_lifts: [{ exercise_id, name }] }
 */
router.get('/schedule', (req, res) => {
  try {
    const schedule = Schedule.get(req.user.id);
    const program = activeProgram(req.user.id);
    res.json({
      days: normalizeDays(schedule.days),
      lift_order: schedule.lift_order,
      program: program ? { id: program.id, name: program.name, type: program.type } : null,
      program_lifts: (program?.lifts ?? []).map((l) => ({ exercise_id: l.exercise_id, name: l.exercise_name })),
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Failed to get the schedule' });
  }
});

/**
 * PUT /api/week/schedule
 * Body: { days: [7 slots, Sunday first], lift_order?: [exercise_id] }
 */
router.put('/schedule', (req, res) => {
  try {
    const days = normalizeDays(req.body?.days);
    if (!days) return res.status(400).json({ error: `days must be 7 slots, each one of: ${SLOTS.join(', ')}` });
    const order = req.body.lift_order ?? [];
    if (!Array.isArray(order) || order.length > 50 || !order.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
      return res.status(400).json({ error: 'lift_order must be a list of exercise ids' });
    }
    const saved = Schedule.save(req.user.id, { days, lift_order: [...new Set(order.map(Number))] });
    res.json(saved);
  } catch (error) {
    console.error('Save schedule error:', error);
    res.status(500).json({ error: 'Failed to save the schedule' });
  }
});

/**
 * PUT /api/week/days/:date  Body: { slot }
 * Change what one date is for (e.g. lift Thursday instead of Wednesday this week).
 */
router.put('/days/:date', (req, res) => {
  try {
    if (!isDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
    const slot = req.body?.slot;
    if (!SLOTS.includes(slot)) return res.status(400).json({ error: `slot must be one of: ${SLOTS.join(', ')}` });
    Schedule.setOverride(req.user.id, req.params.date, slot);
    res.json({ date: req.params.date, slot });
  } catch (error) {
    console.error('Set day error:', error);
    res.status(500).json({ error: 'Failed to change the day' });
  }
});

/** DELETE /api/week/days/:date: back to the weekly schedule for that date. */
router.delete('/days/:date', (req, res) => {
  try {
    if (!isDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
    Schedule.clearOverride(req.user.id, req.params.date);
    res.json({ date: req.params.date, slot: null });
  } catch (error) {
    console.error('Clear day error:', error);
    res.status(500).json({ error: 'Failed to change the day' });
  }
});

export default router;
