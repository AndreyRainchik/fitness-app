import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { User, Workout } from '../models/index.js';
import { AiConnection, CoachStyle, WorkoutFeedback } from '../models/Coach.js';
import { COACH_STYLES, CoachError, checkApiKey, generateFeedback } from '../services/aiCoach.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * AI coach: feedback on a workout, written by Claude with the user's own
 * Anthropic API key.
 *
 *   GET    /api/coach/status                  whether an AI key is saved, and the chosen style
 *   PUT    /api/coach/style                   choose the coach's style
 *   PUT    /api/coach/connection              save (and check) an Anthropic API key
 *   DELETE /api/coach/connection              forget the key
 *   GET    /api/coach/workouts/:id/feedback   the saved feedback for a workout, or null
 *   POST   /api/coach/workouts/:id/feedback   generate (or regenerate) the feedback
 */

const router = express.Router();
router.use(authenticateToken);

function validationFailed(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  return true;
}

function sendCoachError(res, error, context) {
  if (error instanceof CoachError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`Coach ${context} error:`, error);
  return res.status(500).json({ error: `Failed to ${context}` });
}

/** The workout if the user owns it, else sends 404 and returns null. */
function ownWorkout(req, res) {
  const workout = Workout.getWithDetails(Number(req.params.id));
  if (!workout || workout.user_id !== req.user.id) {
    res.status(404).json({ error: 'Workout not found' });
    return null;
  }
  return workout;
}

function feedbackResponse(saved, workout) {
  if (!saved) return { feedback: null };
  return {
    feedback: saved.feedback,
    model: saved.model,
    style: saved.style || 'normal',
    created_at: saved.created_at,
    // The workout was edited after the feedback was written
    stale: (saved.workout_edited_at ?? null) !== (workout.edited_at ?? null),
  };
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const styleOptions = () => Object.entries(COACH_STYLES).map(([id, s]) => ({ id, label: s.label }));

router.get('/status', (req, res) => {
  try {
    res.json({ ...AiConnection.status(req.user.id), style: CoachStyle.get(req.user.id), styles: styleOptions() });
  } catch (error) {
    sendCoachError(res, error, 'get AI coach status');
  }
});

router.put('/style',
  [body('style').isIn(Object.keys(COACH_STYLES)).withMessage('Choose one of the coach styles')],
  (req, res) => {
    if (validationFailed(req, res)) return;
    try {
      CoachStyle.set(req.user.id, req.body.style);
      res.json({ style: req.body.style });
    } catch (error) {
      sendCoachError(res, error, 'save the coach style');
    }
  }
);

router.put('/connection',
  [body('api_key').isString().trim().isLength({ min: 20, max: 300 }).withMessage('Enter your Anthropic API key')],
  async (req, res) => {
    if (validationFailed(req, res)) return;
    const apiKey = req.body.api_key.trim();
    try {
      await checkApiKey(apiKey);
      res.json({ ...AiConnection.save(req.user.id, apiKey, 'anthropic'), style: CoachStyle.get(req.user.id), styles: styleOptions() });
    } catch (error) {
      sendCoachError(res, error, 'save the API key');
    }
  }
);

router.delete('/connection', (req, res) => {
  try {
    AiConnection.remove(req.user.id);
    res.json({ connected: false, style: CoachStyle.get(req.user.id), styles: styleOptions() });
  } catch (error) {
    sendCoachError(res, error, 'remove the API key');
  }
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

router.get('/workouts/:id/feedback', [param('id').isInt({ min: 1 })], (req, res) => {
  if (validationFailed(req, res)) return;
  try {
    const workout = ownWorkout(req, res);
    if (!workout) return;
    res.json(feedbackResponse(WorkoutFeedback.find(workout.id), workout));
  } catch (error) {
    sendCoachError(res, error, 'load the feedback');
  }
});

// Workouts with feedback being written right now, so a double click doesn't pay twice
const inFlight = new Set();

router.post('/workouts/:id/feedback', [param('id').isInt({ min: 1 })], async (req, res) => {
  if (validationFailed(req, res)) return;
  const workout = ownWorkout(req, res);
  if (!workout) return;

  const apiKey = AiConnection.apiKey(req.user.id);
  if (!apiKey) {
    const saved = AiConnection.find(req.user.id);
    return res.status(400).json({
      error: saved
        ? 'Your saved Anthropic API key can no longer be read. Enter it again in Profile > Integrations.'
        : 'Add your Anthropic API key in Profile > Integrations to use the AI coach.',
      code: 'ai_not_connected',
    });
  }
  if ((workout.sets?.length ?? 0) === 0 && workout.kind !== 'cardio') {
    return res.status(400).json({ error: 'Log some sets first: there is nothing to review yet.' });
  }
  if (inFlight.has(workout.id)) {
    return res.status(409).json({ error: 'Feedback for this workout is already being written.' });
  }

  inFlight.add(workout.id);
  try {
    const user = User.findById(req.user.id);
    const { feedback, model, style } = await generateFeedback(apiKey, user, workout, CoachStyle.get(req.user.id));
    const saved = WorkoutFeedback.save({
      workout_id: workout.id,
      user_id: req.user.id,
      feedback,
      model,
      style,
      workout_edited_at: workout.edited_at,
    });
    res.json(feedbackResponse(saved, workout));
  } catch (error) {
    sendCoachError(res, error, 'write the feedback');
  } finally {
    inFlight.delete(workout.id);
  }
});

export default router;
