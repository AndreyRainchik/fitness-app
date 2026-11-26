import Anthropic from '@anthropic-ai/sdk';
import { all } from '../config/database.js';
import { estimate1RM } from '../utils/strengthCalculations.js';

/**
 * The AI coach: feedback on one workout, written by Claude with the user's own
 * Anthropic API key.
 */

/**
 * The Claude models the coach can use. Cost is a rough figure for one
 * feedback on a typical session (about 2,500 tokens in, 1,000 out).
 */
export const COACH_MODELS = {
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', cost: 'about $0.001 per feedback' },
  'claude-sonnet-5-5': {
    label: 'Claude Sonnet 5.5',
    cost: 'about $0.015 per feedback',
    // If Sonnet's safety check wrongly declines a review, the API retries it on
    // a fallback model in the same call (Haiku has no server-side fallback)
    fallback: true,
  },
};

export const DEFAULT_COACH_MODEL = 'claude-haiku-5-5';

const modelOrDefault = (model) => (COACH_MODELS[model] ? model : DEFAULT_COACH_MODEL);

/** A user's AI key was refused, or the provider couldn't be used. */
export class CoachError extends Error {
  constructor(message, { status = 502, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SYSTEM_PROMPT = `You are an experienced strength and conditioning coach reviewing one training session that your athlete logged in their training app.

Give feedback the athlete can act on: what went well, what to watch or improve, and what to do next time. Base every point on the numbers you were given: compare against their previous sessions of the same exercise when that history is there, and mention personal bests. Name exercises and numbers specifically ("Bench press: 3x5 at 185, up 5 from last week") rather than speaking in generalities.

Rules:
- Weights are in the athlete's unit, given with the data. Negative weights are machine assistance (more negative means more help), so a smaller assistance number is progress.
- Warm-up sets are marked; judge the working sets.
- RPE, when logged, is rate of perceived exertion out of 10.
- Don't invent data you weren't given. If something useful is missing (no RPE, no history), work with what's there; mention it at most once.
- No medical advice or diagnosis. If the notes mention pain or injury, suggest they get it checked by a professional and keep the rest of the feedback conservative.
- Keep each point to one or two sentences, plain text, no markdown. Speak to the athlete directly ("you").
- Write in the style given in the user's message. The style changes only the tone: the facts, the targets and the rules above stay the same.`;

/**
 * The voices the coach can write in. Only the tone changes: the facts, the
 * targets and the safety rules in SYSTEM_PROMPT are the same in every style.
 */
export const COACH_STYLES = {
  normal: {
    label: 'Normal',
    prompt: 'Tone: clear, friendly and professional, like a good coach who respects the athlete\'s time. No emojis.',
  },
  tough_love: {
    label: 'Tough love',
    prompt: `Tone: tough love. Blunt and demanding, in short sentences. Give credit only where it was earned, and call out missed reps and sloppy habits directly. The toughness is about standards, never about the athlete as a person: don't insult, mock or belittle them or their body. Never tell them to push through pain or ignore an injury; being tough about recovery and getting things checked is part of the style. No emojis.`,
  },
  kawaii: {
    label: 'Kawaii anime girlfriend',
    prompt: `Tone: a cheerful, affectionate kawaii anime girlfriend cheering the athlete on. Use cute expressions ("~", "hehe", "mou") and an occasional kaomoji such as (≧◡≦), and start some points with an emoji (💖 🌸 ✨ 🎀 ⭐). Keep it wholesome: sweet and supportive, never sexual, suggestive, jealous or possessive. Concern about pain or injury should be gentle but still clear. The numbers and advice must be exactly as specific and accurate as in a plain coaching review.`,
  },
};

export const DEFAULT_COACH_STYLE = 'normal';

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentences on the session overall.' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'What went well: 1 to 4 points.' },
    improvements: { type: 'array', items: { type: 'string' }, description: 'What to watch or do better: 1 to 4 points.' },
    next_session: { type: 'array', items: { type: 'string' }, description: 'Concrete targets for next time: 1 to 4 points.' },
  },
  required: ['summary', 'highlights', 'improvements', 'next_session'],
  additionalProperties: false,
};

const round = (n, digits = 1) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

function describeSet(s) {
  const parts = [`${s.weight} x ${s.reps}`];
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  if (s.is_warmup) parts.push('warm-up');
  if (s.notes) parts.push(`note: ${s.notes}`);
  return parts.join(', ');
}

/** The most recent earlier session of an exercise, and the best e1RM before this workout. */
function exerciseHistory(userId, exerciseId, workout) {
  const earlier = all(
    `SELECT w.id AS workout_id, w.date, s.weight, s.reps, s.rpe, s.is_warmup
     FROM sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.user_id = ? AND s.exercise_id = ? AND w.id != ?
       AND (w.date < ? OR (w.date = ? AND w.id < ?))
     ORDER BY w.date DESC, w.id DESC, s.set_number`,
    [userId, exerciseId, workout.id, workout.date, workout.date, workout.id]
  );
  if (earlier.length === 0) return null;
  const lastId = earlier[0].workout_id;
  const lastSets = earlier.filter((s) => s.workout_id === lastId && !s.is_warmup);
  const working = earlier.filter((s) => !s.is_warmup);
  const best = working.length ? Math.max(...working.map((s) => estimate1RM(s.weight, s.reps))) : null;
  return {
    last_date: earlier[0].date,
    last_working_sets: lastSets.map(describeSet),
    best_estimated_1rm_before: round(best),
    sessions_logged_before: new Set(earlier.map((s) => s.workout_id)).size,
  };
}

/** Everything the coach is told about the workout, as plain JSON. */
export function buildWorkoutContext(user, workout) {
  const units = user.units || 'kg';
  const context = {
    athlete: {
      weight_unit: units,
      bodyweight: user.bodyweight ?? null,
      sex: user.sex === 'M' ? 'male' : user.sex === 'F' ? 'female' : null,
    },
    session: {
      date: workout.date,
      name: workout.name || null,
      type: workout.kind === 'cardio' ? 'cardio' : 'strength',
      duration_minutes: workout.duration_minutes || null,
      notes: workout.notes || null,
    },
  };

  if (workout.metrics) {
    const { avg_hr, max_hr, calories } = workout.metrics;
    context.session.heart_rate = { avg_bpm: avg_hr, max_bpm: max_hr, calories };
  }

  if (workout.kind === 'cardio' && workout.cardio) {
    const c = workout.cardio;
    let splits = null;
    try {
      splits = c.splits_json ? JSON.parse(c.splits_json) : null;
    } catch { /* ignore */ }
    context.session.cardio = {
      sport: c.sport,
      environment: c.environment,
      moving_time_s: c.duration_s,
      distance_m: c.distance_m,
      elevation_gain_m: c.elevation_gain_m,
      avg_cadence: c.avg_cadence,
      splits: Array.isArray(splits) ? splits.slice(0, 50) : null,
    };
  }

  // Exercises in the order they were done
  const byExercise = new Map();
  for (const s of workout.sets || []) {
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { name: s.exercise_name, muscle: s.primary_muscle_group, sets: [] });
    }
    byExercise.get(s.exercise_id).sets.push(s);
  }
  if (byExercise.size > 0) {
    context.exercises = [...byExercise.entries()].map(([exerciseId, ex]) => {
      const working = ex.sets.filter((s) => !s.is_warmup);
      const best = working.length ? Math.max(...working.map((s) => estimate1RM(s.weight, s.reps))) : null;
      return {
        exercise: ex.name,
        primary_muscle: ex.muscle,
        sets: ex.sets.map(describeSet),
        best_estimated_1rm_today: round(best),
        history: exerciseHistory(user.id, exerciseId, workout),
      };
    });
  }

  // What else they trained in the fortnight before, for recovery and balance
  context.previous_14_days = all(
    `SELECT w.date, w.name, w.kind,
       (SELECT GROUP_CONCAT(DISTINCT e.name) FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE s.workout_id = w.id) AS exercises
     FROM workouts w
     WHERE w.user_id = ? AND w.id != ? AND w.date < ? AND w.date >= date(?, '-14 days')
     ORDER BY w.date DESC LIMIT 20`,
    [user.id, workout.id, workout.date, workout.date]
  ).map((w) => ({ date: w.date, name: w.name, type: w.kind, exercises: w.exercises }));

  return context;
}

/** Turn an Anthropic SDK failure into something the user can act on. */
function toCoachError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return new CoachError('Your Anthropic API key was rejected. Check it in Profile > Integrations.', { status: 400, code: 'ai_key_rejected' });
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new CoachError("Your Anthropic API key isn't allowed to use this model.", { status: 400, code: 'ai_key_rejected' });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new CoachError('Anthropic is rate limiting your key. Try again in a minute.', { status: 429 });
  }
  if (error instanceof Anthropic.BadRequestError) {
    // e.g. no credit left on the account; Anthropic's message says so
    return new CoachError(`Anthropic refused the request: ${error.error?.error?.message || error.message}`, { status: 400 });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new CoachError("Couldn't reach Anthropic. Try again shortly.", { status: 502 });
  }
  if (error instanceof Anthropic.APIError) {
    return new CoachError(`Anthropic error (${error.status ?? 'unknown'}). Try again shortly.`, { status: 502 });
  }
  return error;
}

/** Checks an API key works, without spending tokens. Throws CoachError. */
export async function checkApiKey(apiKey) {
  try {
    await new Anthropic({ apiKey, maxRetries: 1 }).models.retrieve(DEFAULT_COACH_MODEL);
  } catch (error) {
    throw toCoachError(error);
  }
}

/** Feedback for a workout: { summary, highlights, improvements, next_session }. Throws CoachError. */
export async function generateFeedback(apiKey, user, workout, styleKey = DEFAULT_COACH_STYLE, modelKey = DEFAULT_COACH_MODEL) {
  const client = new Anthropic({ apiKey, timeout: 90_000 });
  const model = modelOrDefault(modelKey);
  const context = buildWorkoutContext(user, workout);
  const style = COACH_STYLES[styleKey] ?? COACH_STYLES[DEFAULT_COACH_STYLE];

  let response;
  try {
    const params = {
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: FEEDBACK_SCHEMA },
      },
      messages: [{
        role: 'user',
        // The style goes here, after the fixed system prompt, so the system prompt stays the same for every user
        content: `Style for this review. ${style.prompt}\n\nHere is the session to review, with my recent history:\n\n${JSON.stringify(context, null, 2)}`,
      }],
    };
    response = COACH_MODELS[model].fallback
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (error) {
    throw toCoachError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new CoachError("The coach couldn't review this workout. Try regenerating, or edit the notes.", { status: 422 });
  }
  if (response.stop_reason === 'max_tokens') {
    throw new CoachError('The feedback was cut off. Try regenerating.', { status: 502 });
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let feedback;
  try {
    feedback = JSON.parse(text);
  } catch {
    throw new CoachError('The coach answered in an unexpected format. Try regenerating.', { status: 502 });
  }
  // The model that actually wrote it (a fallback model, if one took over)
  return { feedback, model: response.model || model, style: COACH_STYLES[styleKey] ? styleKey : DEFAULT_COACH_STYLE };
}
