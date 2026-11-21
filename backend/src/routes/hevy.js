import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { BodyweightLog, Exercise, User, Workout } from '../models/index.js';
import { HevyConnection, HevyExerciseMapping, HevyImportedWorkouts, HevyWeightSyncs } from '../models/Hevy.js';
import { pushBodyweight, weightSyncStatus } from '../services/hevyWeightSync.js';
import { HevyApiError, HevyClient } from '../services/hevyClient.js';
import {
  collectExerciseTemplates,
  convertHevyWorkout,
  createExerciseMatcher,
  newExerciseFromTemplate,
  summarizeHevyWorkout,
} from '../services/hevyImport.js';
import { authenticateToken } from '../middleware/auth.js';
import { linkUnmatchedStrength } from '../services/stravaSync.js';
import { all, transaction } from '../config/database.js';

/**
 * Import workouts from Hevy, chosen by the user.
 *
 *   GET    /api/hevy/status           connection status
 *   PUT    /api/hevy/connection       save (and check) a Hevy API key
 *   DELETE /api/hevy/connection       forget the API key
 *   GET    /api/hevy/workouts         one page of Hevy workouts, each marked new / imported / changed
 *   GET    /api/hevy/workouts/latest  the newest Hevy workout, marked the same way (for the dashboard)
 *   POST   /api/hevy/preview          exercises used by the chosen workouts, with suggested matches
 *   POST   /api/hevy/import           import the chosen workouts
 *   GET    /api/hevy/weight           bodyweight dates and whether each is in Hevy
 *   POST   /api/hevy/weight/sync      send bodyweight to Hevy
 */

const router = express.Router();
router.use(authenticateToken);

const MAX_WORKOUTS_PER_IMPORT = 50;
const HEVY_CONCURRENCY = 4;

const EXERCISE_CATEGORIES = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'other'];

function validationFailed(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  return true;
}

/** Send a Hevy failure to the browser with a status it can act on. */
function sendHevyError(res, error, context) {
  if (error instanceof HevyApiError) {
    if (error.isAuthError) {
      return res.status(400).json({ error: error.message, code: 'hevy_key_rejected' });
    }
    const status = error.status === 429 ? 429 : error.status === 404 ? 404 : 502;
    return res.status(status).json({ error: error.message });
  }
  console.error(`Hevy ${context} error:`, error);
  return res.status(500).json({ error: `Failed to ${context}` });
}

/** The user's Hevy client, or sends an error response and returns null. */
function clientFor(req, res) {
  const apiKey = HevyConnection.apiKey(req.user.id);
  if (!apiKey) {
    const connected = HevyConnection.find(req.user.id);
    res.status(400).json({
      error: connected
        ? 'Your saved Hevy API key can no longer be read. Enter it again in Profile > Integrations.'
        : 'Connect your Hevy account first (Profile > Integrations).',
      code: 'hevy_not_connected',
    });
    return null;
  }
  return new HevyClient(apiKey);
}

/** Run fn over items with at most `limit` running at a time, keeping order. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Hevy workouts for the given ids. Ids Hevy no longer has are returned in
 * `missing` rather than failing the whole request.
 */
async function fetchHevyWorkouts(client, ids) {
  const missing = [];
  const fetched = await mapWithConcurrency(ids, HEVY_CONCURRENCY, async (id) => {
    try {
      return await client.getWorkout(id);
    } catch (error) {
      if (error instanceof HevyApiError && error.status === 404) {
        missing.push(id);
        return null;
      }
      throw error;
    }
  });
  return { workouts: fetched.filter(Boolean), missing };
}

/** 'new' | 'imported' | 'changed' (edited in Hevy after it was imported). */
function importStatus(hevyWorkout, imported) {
  if (!imported) return 'new';
  if (hevyWorkout.updated_at && imported.hevy_updated_at
      && Date.parse(hevyWorkout.updated_at) > Date.parse(imported.hevy_updated_at)) {
    return 'changed';
  }
  return 'imported';
}

function withImportStatus(userId, hevyWorkouts) {
  const imported = HevyImportedWorkouts.findByHevyIds(userId, hevyWorkouts.map((w) => w.id));
  return hevyWorkouts.map((w) => {
    const local = imported.get(w.id);
    return { ...summarizeHevyWorkout(w), status: importStatus(w, local), local_workout_id: local?.id ?? null };
  });
}

const uniqueIds = (ids) => [...new Set(ids.map(String))];

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

router.get('/status', (req, res) => {
  try {
    res.json(HevyConnection.status(req.user.id));
  } catch (error) {
    console.error('Hevy status error:', error);
    res.status(500).json({ error: 'Failed to get Hevy status' });
  }
});

router.put('/connection',
  [body('api_key').isString().trim().isLength({ min: 8, max: 200 }).withMessage('Enter your Hevy API key')],
  async (req, res) => {
    if (validationFailed(req, res)) return;
    const apiKey = req.body.api_key.trim();
    try {
      // Check the key works before saving it
      const info = await new HevyClient(apiKey).getUserInfo();
      const status = HevyConnection.save(req.user.id, apiKey, info?.username || info?.name || null);
      res.json({ ...status, hevy_weight_unit: info?.weight_unit ?? null });
    } catch (error) {
      sendHevyError(res, error, 'connect to Hevy');
    }
  }
);

router.delete('/connection', (req, res) => {
  try {
    HevyConnection.remove(req.user.id);
    res.json({ connected: false });
  } catch (error) {
    console.error('Hevy disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Hevy' });
  }
});

// ---------------------------------------------------------------------------
// Browsing Hevy workouts
// ---------------------------------------------------------------------------

/**
 * GET /api/hevy/workouts?page=1&mode=all|new
 *
 * mode=all: every Hevy workout, newest first.
 * mode=new: workouts created or edited in Hevy since the last import.
 */
router.get('/workouts',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('mode').optional().isIn(['all', 'new']),
  ],
  async (req, res) => {
    if (validationFailed(req, res)) return;
    const client = clientFor(req, res);
    if (!client) return;

    const page = req.query.page || 1;
    const { last_synced_at: since } = HevyConnection.find(req.user.id);
    const mode = req.query.mode === 'new' && since ? 'new' : 'all';

    try {
      if (mode === 'new') {
        const result = await client.listWorkoutEvents(since, page);
        const updated = result.events.filter((e) => e.type === 'updated' && e.workout).map((e) => e.workout);
        return res.json({
          mode, since, page: result.page, page_count: result.page_count,
          workouts: withImportStatus(req.user.id, updated),
        });
      }
      const result = await client.listWorkouts(page);
      res.json({
        mode, since, page: result.page, page_count: result.page_count,
        workouts: withImportStatus(req.user.id, result.workouts),
      });
    } catch (error) {
      sendHevyError(res, error, 'load Hevy workouts');
    }
  }
);

/**
 * GET /api/hevy/workouts/latest
 * { workout: summary-with-status | null } for the most recent Hevy workout.
 */
router.get('/workouts/latest', async (req, res) => {
  const client = clientFor(req, res);
  if (!client) return;
  try {
    const result = await client.listWorkouts(1, 1);
    const [latest] = withImportStatus(req.user.id, result.workouts.slice(0, 1));
    res.json({ workout: latest ?? null });
  } catch (error) {
    sendHevyError(res, error, 'load your latest Hevy workout');
  }
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const workoutIdsValidator = body('workout_ids')
  .isArray({ min: 1, max: MAX_WORKOUTS_PER_IMPORT })
  .withMessage(`Choose between 1 and ${MAX_WORKOUTS_PER_IMPORT} workouts`);

/**
 * POST /api/hevy/preview { workout_ids }
 *
 * The exercises the chosen workouts use, each with a suggested exercise in
 * this app (the user's earlier choice, else a name match) and default fields
 * for creating a new exercise instead.
 */
router.post('/preview', [workoutIdsValidator, body('workout_ids.*').isString()], async (req, res) => {
  if (validationFailed(req, res)) return;
  const client = clientFor(req, res);
  if (!client) return;

  try {
    const { workouts, missing } = await fetchHevyWorkouts(client, uniqueIds(req.body.workout_ids));
    const saved = HevyExerciseMapping.getForUser(req.user.id);
    const match = createExerciseMatcher(Exercise.getAll());

    const templates = collectExerciseTemplates(workouts);
    const exercises = await mapWithConcurrency(templates, HEVY_CONCURRENCY, async (t) => {
      const savedMapping = saved.get(t.template_id);
      if (savedMapping) {
        return {
          ...t,
          suggestion: { exercise_id: savedMapping.exercise_id, exercise_name: savedMapping.exercise_name, source: 'saved' },
          new_exercise: newExerciseFromTemplate(t.title, null),
        };
      }
      // Hevy's template has the muscle groups and equipment for a new exercise
      let template = null;
      try {
        template = await client.getExerciseTemplate(t.template_id);
      } catch (error) {
        if (!(error instanceof HevyApiError) || error.isAuthError) throw error;
      }
      const found = match(t.title);
      return {
        ...t,
        suggestion: found ? { exercise_id: found.id, exercise_name: found.name, source: 'name_match' } : null,
        new_exercise: newExerciseFromTemplate(t.title, template),
      };
    });

    res.json({ workouts: withImportStatus(req.user.id, workouts), missing, exercises });
  } catch (error) {
    sendHevyError(res, error, 'prepare the Hevy import');
  }
});

/**
 * POST /api/hevy/import
 * {
 *   workout_ids: [hevyWorkoutId],
 *   exercises: { [hevyTemplateId]: { exercise_id } | { create: { name, category, primary_muscle_group } } | { skip: true } },
 *   timezone: 'America/New_York'   // picks each workout's date
 * }
 *
 * New workouts are created; workouts imported before are replaced with
 * Hevy's current version. Every exercise the workouts use needs a choice.
 */
router.post('/import',
  [
    workoutIdsValidator,
    body('workout_ids.*').isString(),
    body('exercises').isObject().withMessage('exercises must be an object'),
    body('timezone').optional().isString().isLength({ max: 64 }),
  ],
  async (req, res) => {
    if (validationFailed(req, res)) return;
    const client = clientFor(req, res);
    if (!client) return;

    const userId = req.user.id;
    const choices = req.body.exercises;

    let workouts;
    let missing;
    try {
      ({ workouts, missing } = await fetchHevyWorkouts(client, uniqueIds(req.body.workout_ids)));
    } catch (error) {
      return sendHevyError(res, error, 'load workouts from Hevy');
    }

    // Every exercise in the chosen workouts needs a valid choice
    const templates = collectExerciseTemplates(workouts);
    const problems = [];
    for (const t of templates) {
      const choice = choices[t.template_id];
      if (!choice || typeof choice !== 'object') {
        problems.push(`Choose what to do with “${t.title}”`);
      } else if (choice.skip) {
        // nothing to check
      } else if (choice.create) {
        const { name, category, primary_muscle_group } = choice.create;
        if (!String(name || '').trim()) problems.push(`Enter a name for the new exercise from “${t.title}”`);
        if (!EXERCISE_CATEGORIES.includes(category)) problems.push(`Choose a category for “${t.title}”`);
        if (!String(primary_muscle_group || '').trim()) problems.push(`Choose a muscle group for “${t.title}”`);
      } else if (!Exercise.findById(Number(choice.exercise_id))) {
        problems.push(`The exercise chosen for “${t.title}” no longer exists`);
      }
    }
    if (problems.length) {
      return res.status(400).json({ error: problems[0], errors: problems });
    }

    try {
      const user = User.findById(userId);
      const units = user?.units === 'kg' ? 'kg' : 'lbs';
      const timeZone = req.body.timezone || 'UTC';
      const titles = new Map(templates.map((t) => [t.template_id, t.title]));

      const result = transaction(() => {
        // Resolve each Hevy exercise to one of this app's exercises
        const existingByName = new Map(all('SELECT id, name FROM exercises').map((e) => [e.name.trim().toLowerCase(), e]));
        const resolved = new Map();
        const createdExercises = [];

        for (const [templateId, title] of titles) {
          const choice = choices[templateId];
          if (choice.skip) continue;

          let exercise;
          if (choice.create) {
            const name = String(choice.create.name).trim();
            // Reuse an exercise that already has this name instead of duplicating it
            exercise = existingByName.get(name.toLowerCase());
            if (!exercise) {
              exercise = Exercise.create({
                name,
                category: choice.create.category,
                primary_muscle_group: String(choice.create.primary_muscle_group).trim(),
                secondary_muscle_groups: Array.isArray(choice.create.secondary_muscle_groups)
                  ? choice.create.secondary_muscle_groups.map(String) : [],
                is_compound: choice.create.is_compound ? 1 : 0,
              });
              existingByName.set(name.toLowerCase(), exercise);
              createdExercises.push({ id: exercise.id, name: exercise.name });
            }
          } else {
            exercise = Exercise.findById(Number(choice.exercise_id));
          }
          resolved.set(templateId, exercise);
          HevyExerciseMapping.upsert(userId, templateId, title, exercise.id);
        }

        const already = HevyImportedWorkouts.findByHevyIds(userId, workouts.map((w) => w.id));
        const imported = [];
        const skipped = missing.map((id) => ({ hevy_id: id, title: null, reason: 'No longer in Hevy' }));

        for (const hevyWorkout of workouts) {
          const converted = convertHevyWorkout(hevyWorkout, {
            exerciseFor: (templateId) => resolved.get(templateId) ?? null,
            units,
            timeZone,
          });
          if (!converted.workout.date) {
            skipped.push({ hevy_id: hevyWorkout.id, title: hevyWorkout.title, reason: 'Hevy workout has no start time' });
            continue;
          }
          if (converted.sets.length === 0) {
            skipped.push({ hevy_id: hevyWorkout.id, title: hevyWorkout.title, reason: 'Every exercise in it was skipped' });
            continue;
          }

          const existing = already.get(hevyWorkout.id);
          let workoutId;
          if (existing && Workout.findById(existing.id)) {
            Workout.updateWithSets(existing.id, converted.workout, converted.sets);
            workoutId = existing.id;
          } else {
            workoutId = Workout.createWithSets({ user_id: userId, ...converted.workout }, converted.sets).id;
          }
          HevyImportedWorkouts.markImported(workoutId, hevyWorkout.id, hevyWorkout.updated_at ?? null);

          imported.push({
            hevy_id: hevyWorkout.id,
            workout_id: workoutId,
            title: converted.workout.name,
            date: converted.workout.date,
            action: existing ? 'updated' : 'created',
            set_count: converted.sets.length,
            skipped_exercises: converted.skipped_exercises,
          });
        }

        if (imported.length > 0) {
          HevyConnection.setLastSynced(userId, new Date().toISOString());
        }
        return { imported, skipped, created_exercises: createdExercises };
      });

      // Strava lifting sessions recorded before these workouts were imported can match now
      linkUnmatchedStrength(userId);
      res.json({ ...result, status: HevyConnection.status(userId) });
    } catch (error) {
      console.error('Hevy import error:', error);
      res.status(500).json({ error: 'Failed to import workouts' });
    }
  }
);

// ---------------------------------------------------------------------------
// Bodyweight -> Hevy
// ---------------------------------------------------------------------------

const MAX_WEIGHT_DATES_PER_SYNC = 60;

function weightStatusFor(userId) {
  const entries = weightSyncStatus(BodyweightLog.getByUser(userId), HevyWeightSyncs.getForUser(userId));
  return { entries, pending_count: entries.filter((e) => e.status !== 'synced').length };
}

/**
 * GET /api/hevy/weight
 * One entry per date with a bodyweight log (newest first), each 'synced',
 * 'not_synced' or 'changed' (edited here since it was sent).
 */
router.get('/weight', (req, res) => {
  try {
    res.json(weightStatusFor(req.user.id));
  } catch (error) {
    console.error('Hevy weight status error:', error);
    res.status(500).json({ error: 'Failed to load bodyweight sync status' });
  }
});

/**
 * POST /api/hevy/weight/sync { dates? }
 * Send bodyweight to Hevy: the given dates, or every date not yet in Hevy
 * (up to 60 per request; `remaining_count` says how many are left).
 * A date that already has an entry in Hevy (409) gets its weight updated,
 * keeping the entry's other measurements.
 */
router.post('/weight/sync',
  [
    body('dates').optional().isArray({ max: MAX_WEIGHT_DATES_PER_SYNC })
      .withMessage(`Send at most ${MAX_WEIGHT_DATES_PER_SYNC} dates at a time`),
    body('dates.*').isISO8601({ strict: true }).withMessage('Dates must be YYYY-MM-DD'),
  ],
  async (req, res) => {
    if (validationFailed(req, res)) return;
    const client = clientFor(req, res);
    if (!client) return;
    const userId = req.user.id;

    const { entries } = weightStatusFor(userId);
    let targets;
    if (Array.isArray(req.body.dates)) {
      const wanted = new Set(req.body.dates.map((d) => String(d).slice(0, 10)));
      targets = entries.filter((e) => wanted.has(e.date));
    } else {
      targets = entries.filter((e) => e.status !== 'synced').slice(0, MAX_WEIGHT_DATES_PER_SYNC);
    }

    const results = [];
    const sent = [];
    let stoppedBy = null;
    // One at a time, oldest first, to stay well inside Hevy's rate limits
    for (const entry of [...targets].reverse()) {
      try {
        const outcome = await pushBodyweight(client, entry.date, entry.weight_kg);
        sent.push({ ...entry, synced_at: new Date().toISOString() });
        results.push({ date: entry.date, outcome });
      } catch (error) {
        if (!(error instanceof HevyApiError)) {
          console.error('Hevy weight sync error:', error);
        }
        const message = error instanceof HevyApiError ? error.message : 'Failed to send to Hevy';
        results.push({ date: entry.date, outcome: 'failed', error: message });
        // A bad key or rate limiting will fail every remaining date too
        if (error instanceof HevyApiError && (error.isAuthError || error.status === 429)) {
          stoppedBy = message;
          break;
        }
      }
    }

    // One database write for the whole batch
    try {
      transaction(() => {
        for (const e of sent) HevyWeightSyncs.record(userId, e.date, e.weight_kg, e.synced_at);
      });
    } catch (error) {
      console.error('Hevy weight sync save error:', error);
      return res.status(500).json({ error: 'Sent to Hevy, but failed to record it here. Syncing again is safe.' });
    }

    const status = weightStatusFor(userId);
    const count = (outcome) => results.filter((r) => r.outcome === outcome).length;
    res.json({
      results: results.reverse(),
      created: count('created'),
      updated: count('updated'),
      unchanged: count('unchanged'),
      failed: count('failed'),
      stopped: stoppedBy,
      remaining_count: status.pending_count,
      ...status,
    });
  }
);

export default router;
