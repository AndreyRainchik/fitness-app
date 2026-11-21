import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { Cardio, Workout } from '../models/index.js';
import { CARDIO_SPORTS, ENVIRONMENTS, DISTANCE_SPORTS } from '../models/Cardio.js';
import { DAY_MS, formatDay, parseDay, summarizeTraining, weekStartOf } from '../services/cardioStats.js';

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
