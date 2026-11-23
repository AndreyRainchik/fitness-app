import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { Cardio, User, Workout } from '../models/index.js';
import { CARDIO_SPORTS, ENVIRONMENTS, DISTANCE_SPORTS } from '../models/Cardio.js';
import {
  DAY_MS, formatDay, parseDay, summarizeRunning, summarizeTraining, summarizeZones, weekStartOf,
} from '../services/cardioStats.js';
import { AthleteThresholds, BestEfforts, SessionAnalysis, loadSessions } from '../models/Analysis.js';
import { calibrateRpe, fitnessCurves, sessionLoads } from '../services/trainingLoad.js';
import {
  EFFORT_DISTANCES, chartSeries, hrZones, routePoints, thresholdsOn, zoneSeconds,
} from '../services/cardioAnalysis.js';
import { readStream } from '../services/streamStore.js';
import { ensureAnalysis } from '../services/stravaSync.js';

const router = express.Router();
router.use(authenticateToken);

const optionalNumber = (field, options, message) =>
  body(field).optional({ values: 'null' }).isFloat(options).withMessage(message).toFloat();
const optionalInt = (field, options, message) =>
  body(field).optional({ values: 'null' }).isInt(options).withMessage(message).toInt();

const sessionValidators = [
  body('date').isISO8601({ strict: true }).withMessage('Valid date is required (YYYY-MM-DD)'),
  body('start_time').optional({ values: 'null' }).isISO8601().withMessage('Start time must be an ISO 8601 timestamp'),
  body('name').optional({ values: 'null' }).isString().isLength({ max: 200 }),
  body('notes').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
  body('sport').isIn(CARDIO_SPORTS).withMessage(`Sport must be one of: ${CARDIO_SPORTS.join(', ')}`),
  body('environment').optional({ values: 'null' }).isIn(ENVIRONMENTS).withMessage('Environment must be indoor or outdoor'),
  body('duration_s').isInt({ min: 1, max: 48 * 3600 }).withMessage('Duration must be between 1 second and 48 hours').toInt(),
  optionalNumber('distance_m', { min: 0, max: 1_000_000 }, 'Distance must be between 0 and 1000 km'),
  optionalNumber('elevation_gain_m', { min: 0, max: 20_000 }, 'Elevation gain must be between 0 and 20,000 m'),
  optionalNumber('avg_cadence', { min: 0, max: 300 }, 'Cadence must be between 0 and 300'),
  optionalInt('avg_hr', { min: 30, max: 250 }, 'Average heart rate must be between 30 and 250 bpm'),
  optionalInt('max_hr', { min: 30, max: 250 }, 'Max heart rate must be between 30 and 250 bpm'),
  optionalInt('calories', { min: 0, max: 20_000 }, 'Calories must be between 0 and 20,000'),
];

/** The validated body as model fields, or { error }. */
function sessionFields(req) {
  const b = req.body;
  if (b.avg_hr != null && b.max_hr != null && b.max_hr < b.avg_hr) {
    return { error: 'Max heart rate cannot be below average heart rate' };
  }
  const blankToNull = (v) => (v === undefined || v === '' ? null : v);
  const distance = blankToNull(b.distance_m);
  return {
    fields: {
      date: b.date.slice(0, 10),
      start_time: blankToNull(b.start_time),
      name: blankToNull(b.name?.trim?.() ?? b.name),
      notes: blankToNull(b.notes?.trim?.() ?? b.notes),
      sport: b.sport,
      environment: blankToNull(b.environment),
      duration_s: b.duration_s,
      // A distance of 0 means "not recorded" (e.g. indoor ride without a sensor)
      distance_m: DISTANCE_SPORTS.has(b.sport) && distance > 0 ? distance : null,
      elevation_gain_m: blankToNull(b.elevation_gain_m),
      avg_cadence: blankToNull(b.avg_cadence),
      avg_hr: blankToNull(b.avg_hr),
      max_hr: blankToNull(b.max_hr),
      calories: blankToNull(b.calories),
    },
  };
}

function validationError(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  return true;
}

/**
 * POST /api/cardio
 * Log a cardio session. Returns { workout } with `cardio` and `metrics` attached.
 */
router.post('/', sessionValidators, (req, res) => {
  if (validationError(req, res)) return;
  try {
    const { fields, error } = sessionFields(req);
    if (error) return res.status(400).json({ error });
    const workout = Cardio.create(req.user.id, fields);
    res.status(201).json({ message: 'Session logged', workout });
  } catch (error) {
    console.error('Create cardio session error:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

/**
 * PUT /api/cardio/:id
 * Replace every field of a cardio session.
 */
router.put('/:id', sessionValidators, (req, res) => {
  if (validationError(req, res)) return;
  try {
    const workout = Workout.findById(req.params.id);
    if (!workout || workout.user_id !== req.user.id) return res.status(404).json({ error: 'Session not found' });
    if (workout.kind !== 'cardio') return res.status(400).json({ error: 'That workout is not a cardio session' });

    const { fields, error } = sessionFields(req);
    if (error) return res.status(400).json({ error });
    res.json({ message: 'Session updated', workout: Cardio.update(workout.id, fields) });
  } catch (error) {
    console.error('Update cardio session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/** The user's today (localDate query) and range start for `weeks` weeks. */
function range(req) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate || '')
    ? req.query.localDate
    : new Date().toISOString().slice(0, 10);
  const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);
  const firstWeek = formatDay(weekStartOf(parseDay(today)) - (weeks - 1) * 7 * DAY_MS);
  return { today, weeks, firstWeek };
}

// ---------------------------------------------------------------------------
// Heart rate settings
// ---------------------------------------------------------------------------

function thresholdsResponse(userId, list = AthleteThresholds.list(userId)) {
  const today = new Date().toISOString().slice(0, 10);
  const current = thresholdsOn(list, today);
  return {
    thresholds: list,
    zones: current ? hrZones(current) : null,
    // A starting point for max HR: the highest seen in the last year
    suggestion: AthleteThresholds.highestSince(userId, formatDay(parseDay(today) - 365 * DAY_MS)),
  };
}

/**
 * GET /api/cardio/thresholds
 * { thresholds: [{ id, effective_date, max_hr, resting_hr }] newest first,
 *   zones: today's five zones or null, suggestion: { max_hr, date, workout_id } | null }
 */
router.get('/thresholds', (req, res) => {
  res.json(thresholdsResponse(req.user.id));
});

/**
 * POST /api/cardio/thresholds { effective_date, max_hr, resting_hr? }
 * Adds settings from a date on (replacing any on that date).
 */
router.post('/thresholds',
  [
    body('effective_date').isISO8601({ strict: true }).withMessage('Valid date is required (YYYY-MM-DD)'),
    body('max_hr').isInt({ min: 100, max: 230 }).withMessage('Max heart rate must be between 100 and 230 bpm').toInt(),
    optionalInt('resting_hr', { min: 25, max: 120 }, 'Resting heart rate must be between 25 and 120 bpm'),
  ],
  (req, res) => {
    if (validationError(req, res)) return;
    const { effective_date: date, max_hr: max, resting_hr: rest } = req.body;
    if (rest != null && rest >= max - 20) {
      return res.status(400).json({ error: 'Resting heart rate must be well below max heart rate' });
    }
    try {
      const list = AthleteThresholds.save(req.user.id, { effective_date: date.slice(0, 10), max_hr: max, resting_hr: rest ?? null });
      res.status(201).json(thresholdsResponse(req.user.id, list));
    } catch (error) {
      console.error('Save thresholds error:', error);
      res.status(500).json({ error: 'Failed to save heart rate settings' });
    }
  }
);

router.delete('/thresholds/:id', (req, res) => {
  try {
    const list = AthleteThresholds.remove(req.user.id, Number(req.params.id));
    res.json(thresholdsResponse(req.user.id, list));
  } catch (error) {
    console.error('Delete thresholds error:', error);
    res.status(500).json({ error: 'Failed to delete heart rate settings' });
  }
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * GET /api/cardio/zones?weeks=&localDate=
 * Weekly minutes in each heart rate zone (strength and cardio sessions with
 * second-by-second HR). See summarizeZones.
 */
router.get('/zones', (req, res) => {
  try {
    const { today, weeks, firstWeek } = range(req);
    const thresholds = AthleteThresholds.list(req.user.id);
    const summary = summarizeZones(SessionAnalysis.sessionsSince(req.user.id, firstWeek), thresholds, { today, weeks });
    const current = thresholdsOn(thresholds, today);
    res.json({ weeks, has_thresholds: thresholds.length > 0, zones: current ? hrZones(current) : null, ...summary });
  } catch (error) {
    console.error('Zones summary error:', error);
    res.status(500).json({ error: 'Failed to get heart rate zones' });
  }
});

/**
 * GET /api/cardio/running?weeks=&localDate=
 * Best efforts (all-time and in the range), VDOT from the range's best
 * effort of a mile or more, and race predictions. See summarizeRunning.
 */
router.get('/running', (req, res) => {
  try {
    const { weeks, firstWeek } = range(req);
    res.json({ weeks, ...summarizeRunning(BestEfforts.forUser(req.user.id), { since: firstWeek }) });
  } catch (error) {
    console.error('Running summary error:', error);
    res.status(500).json({ error: 'Failed to get running records' });
  }
});

/**
 * GET /api/cardio/load?weeks=&localDate=
 * Training load per session (heart rate first, then RPE, then duration) and
 * the fitness / fatigue / form curves, calculated from the whole history and
 * returned for the last `weeks` weeks. See services/trainingLoad.js.
 *
 * { needs_thresholds, assumed_resting_hr, daily, weekly, today, sources,
 *   calibration: { factor, sessions } }
 */
router.get('/load', (req, res) => {
  try {
    const { today, weeks } = range(req);
    const thresholds = AthleteThresholds.list(req.user.id);
    if (!thresholds.length) return res.json({ weeks, needs_thresholds: true });

    const sex = User.findById(req.user.id)?.sex ?? null;
    const sessions = loadSessions(req.user.id);
    const curves = fitnessCurves(sessionLoads(sessions, thresholds, sex), { today, weeks });
    res.json({
      weeks,
      needs_thresholds: false,
      assumed_resting_hr: thresholds.some((t) => !t.resting_hr),
      calibration: calibrateRpe(sessions, thresholds, sex),
      ...curves,
    });
  } catch (error) {
    console.error('Training load error:', error);
    res.status(500).json({ error: 'Failed to get training load' });
  }
});

/**
 * GET /api/cardio/:id/analysis
 * Charts, route, time in zones and best efforts for one session (cardio or
 * strength). Fetches the second-by-second data from Strava first if it
 * hasn't been yet.
 *
 * { status: 'ok' | 'none' | 'unavailable' | 'rate_limited',
 *   series: [{ t, d?, hr?, v?, alt?, cad? }], route: [[lat, lng]] | null,
 *   zones: { zones: [...], seconds: [5] } | null,
 *   best_efforts: [{ key, label, seconds, record }] }
 */
router.get('/:id/analysis', async (req, res) => {
  try {
    const workout = Workout.findById(req.params.id);
    if (!workout || workout.user_id !== req.user.id) return res.status(404).json({ error: 'Session not found' });

    const status = await ensureAnalysis(req.user.id, workout.id);
    const empty = { status, series: [], route: null, zones: null, best_efforts: [] };
    if (status !== 'ok') return res.json(empty);

    const stream = readStream(workout.id);
    const analysis = SessionAnalysis.find(workout.id);
    const histogram = analysis?.hr_histogram ? JSON.parse(analysis.hr_histogram) : null;
    const settings = thresholdsOn(AthleteThresholds.list(req.user.id), workout.date);
    const zones = histogram && settings ? hrZones(settings) : null;

    // Which of this session's efforts are the user's all-time best
    const allEfforts = BestEfforts.forUser(req.user.id);
    const best_efforts = BestEfforts.forWorkout(workout.id).map((e) => {
      const distance = EFFORT_DISTANCES.find((d) => d.key === e.effort_key);
      const fastest = Math.min(...allEfforts.filter((x) => x.effort_key === e.effort_key).map((x) => x.seconds));
      return { key: e.effort_key, label: distance?.label ?? e.effort_key, meters: distance?.meters, seconds: e.seconds, record: e.seconds <= fastest };
    }).sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0));

    res.json({
      ...empty,
      series: stream ? chartSeries(stream) : [],
      route: stream ? routePoints(stream) : null,
      zones: zones ? { zones, seconds: zoneSeconds(histogram, zones) } : null,
      has_hr: Boolean(histogram),
      best_efforts,
    });
  } catch (error) {
    console.error('Session analysis error:', error);
    res.status(500).json({ error: 'Failed to analyse session' });
  }
});

/**
 * GET /api/cardio/summary
 * Query: localDate (YYYY-MM-DD, the user's today), weeks (4–52, default 12)
 *
 * Weekly training minutes by type (strength + each cardio sport), this
 * week's totals, and per-sport totals over the range. See summarizeTraining.
 */
router.get('/summary',
  [query('localDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/), query('weeks').optional().isInt()],
  (req, res) => {
    try {
      const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate || '')
        ? req.query.localDate
        : new Date().toISOString().slice(0, 10);
      const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);
      const firstWeek = weekStartOf(parseDay(today)) - (weeks - 1) * 7 * DAY_MS;

      const sessions = Cardio.sessionsSince(req.user.id, formatDay(firstWeek));
      res.json({ weeks, ...summarizeTraining(sessions, { today, weeks }) });
    } catch (error) {
      console.error('Cardio summary error:', error);
      res.status(500).json({ error: 'Failed to get training summary' });
    }
  }
);

export default router;
