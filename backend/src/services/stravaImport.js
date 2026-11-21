/**
 * Turns Strava activities into this app's sessions, and finds the session
 * here that a Strava activity is the same as.
 *
 * Pure functions (no database or network) so they can be tested directly.
 * Works with both summary activities (from the activity list) and detailed
 * ones (which add calories, description and splits).
 */

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide', 'Velomobile', 'Handcycle']);
const ROW_TYPES = new Set(['Rowing', 'VirtualRow']);
const CLIMB_TYPES = new Set(['RockClimbing']);
// Lifting sessions recorded on the watch: matched to a workout logged here
// (from Hevy or by hand) instead of becoming a session of their own
const STRENGTH_TYPES = new Set(['WeightTraining', 'Crossfit']);

const sportType = (activity) => activity.sport_type || activity.type || '';

const hasGps = (activity) =>
  (Array.isArray(activity.start_latlng) && activity.start_latlng.length === 2)
  || Boolean(activity.map?.summary_polyline);

/**
 * What a Strava activity is here:
 *   { kind: 'cardio', sport, environment }
 *   { kind: 'strength' }   a lifting session, to be matched to a workout
 */
export function classifyActivity(activity) {
  const type = sportType(activity);
  if (STRENGTH_TYPES.has(type)) return { kind: 'strength' };

  let sport = 'other';
  if (RUN_TYPES.has(type)) sport = 'run';
  else if (RIDE_TYPES.has(type)) sport = 'ride';
  else if (ROW_TYPES.has(type)) sport = 'row';
  else if (CLIMB_TYPES.has(type)) sport = 'boulder';

  let environment;
  if (sport === 'boulder' || type.startsWith('Virtual') || activity.trainer) environment = 'indoor';
  else environment = hasGps(activity) ? 'outdoor' : 'indoor';

  return { kind: 'cardio', sport, environment };
}

const roundOrNull = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** { avg_hr, max_hr, calories } (calories only on detailed activities). */
export function activityMetrics(activity) {
  const hr = activity.has_heartrate !== false;
  return {
    avg_hr: hr ? roundOrNull(activity.average_heartrate) : null,
    max_hr: hr ? roundOrNull(activity.max_heartrate) : null,
    calories: roundOrNull(activity.calories),
  };
}

/** The local calendar date the activity started on ('YYYY-MM-DD'). */
export function activityDate(activity) {
  return String(activity.start_date_local || activity.start_date).slice(0, 10);
}

/** Seconds of activity: moving time, or elapsed time when moving time is missing. */
export function activitySeconds(activity) {
  const moving = Number(activity.moving_time);
  return moving > 0 ? Math.round(moving) : Math.round(Number(activity.elapsed_time) || 0);
}

function compactSplits(splits) {
  if (!Array.isArray(splits) || splits.length === 0) return null;
  return splits.map((s) => ({
    distance: roundOrNull(s.distance, 1) ?? 0,
    moving_time: Math.round(Number(s.moving_time) || 0),
    elevation_difference: Number.isFinite(Number(s.elevation_difference)) ? Math.round(Number(s.elevation_difference) * 10) / 10 : null,
    average_heartrate: roundOrNull(s.average_heartrate),
  }));
}

/**
 * Fields for Cardio.create / Cardio.update from a Strava activity.
 * `notes` and `splits_json` are left undefined for summary activities, so
 * updating from a summary keeps what a detailed fetch stored before.
 */
export function cardioFields(activity, { sport, environment }) {
  const detailed = activity.resource_state === 3 || activity.calories !== undefined;
  const metric = compactSplits(activity.splits_metric);
  const standard = compactSplits(activity.splits_standard);
  // Strava reports running cadence per leg; steps per minute is double that
  const cadence = roundOrNull(activity.average_cadence, 1);

  return {
    date: activityDate(activity),
    start_time: new Date(activity.start_date).toISOString(),
    name: activity.name?.trim() || null,
    notes: detailed ? activity.description?.trim() || null : undefined,
    sport,
    environment,
    duration_s: Math.max(1, activitySeconds(activity)),
    distance_m: sport === 'boulder' ? null : roundOrNull(activity.distance, 1),
    elevation_gain_m: environment === 'outdoor' ? roundOrNull(activity.total_elevation_gain) : null,
    avg_cadence: cadence === null ? null : sport === 'run' ? Math.round(cadence * 2) : cadence,
    ...activityMetrics(activity),
    summary_polyline: activity.map?.summary_polyline || null,
    splits_json: detailed ? (metric || standard ? JSON.stringify({ metric, standard }) : null) : undefined,
  };
}

/** The ledger fields kept for every activity seen. */
export function ledgerFields(activity, { detailed }) {
  return {
    activity_id: String(activity.id),
    sport_type: sportType(activity) || null,
    name: activity.name ?? null,
    start_date: activity.start_date ?? null,
    start_date_local: activity.start_date_local ?? null,
    elapsed_s: Math.round(Number(activity.elapsed_time) || 0) || null,
    ...activityMetrics(activity),
    detailed,
  };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const MINUTE = 60 * 1000;
const STRENGTH_WINDOW_MS = 30 * MINUTE;
const CARDIO_WINDOW_MS = 10 * MINUTE;

const DAY_MS = 24 * 60 * MINUTE;
const dayNumber = (date) => Math.floor(Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`) / DAY_MS);

/**
 * The strength workout a Strava lifting session is, or null.
 *
 * activity: { start_date, start_date_local, elapsed_s }
 * workouts: [{ id, date, start_time, duration_minutes }] strength workouts
 *           not yet linked to a Strava activity
 *
 * A workout with a start time (imported from Hevy) matches when it started
 * within 30 minutes of the activity, or the two overlap. One without a start
 * time matches on the same date; when there are several, the one whose
 * duration is closest wins. A timed match always beats a date-only one.
 */
export function matchStrengthWorkout(activity, workouts) {
  const start = Date.parse(activity.start_date);
  const end = start + (Number(activity.elapsed_s) || 0) * 1000;
  const date = String(activity.start_date_local || activity.start_date).slice(0, 10);
  const minutes = (Number(activity.elapsed_s) || 0) / 60;

  let best = null;
  for (const w of workouts) {
    let score = null;
    if (w.start_time) {
      const wStart = Date.parse(w.start_time);
      const wEnd = wStart + (w.duration_minutes > 0 ? w.duration_minutes : 60) * MINUTE;
      const gap = Math.abs(wStart - start);
      const overlaps = wStart < end && start < wEnd;
      if (gap <= STRENGTH_WINDOW_MS || overlaps) score = gap;
    } else if (String(w.date).slice(0, 10) === date) {
      score = 1e12 + Math.abs((w.duration_minutes || 0) - minutes);
    }
    if (score !== null && (!best || score < best.score)) best = { workout: w, score };
  }
  return best?.workout ?? null;
}

/**
 * A session logged here by hand that is the same as this Strava activity, or
 * null. Same sport, and started within 10 minutes (when both have a start
 * time) or same date with a duration within 10% (at least 5 minutes).
 *
 * sessions: [{ id, date, start_time, sport, duration_s }] cardio sessions not
 * yet linked to a Strava activity
 */
export function findCardioDuplicate(fields, sessions) {
  const start = Date.parse(fields.start_time);
  let best = null;
  for (const s of sessions) {
    if (s.sport !== fields.sport) continue;
    if (Math.abs(dayNumber(s.date) - dayNumber(fields.date)) > 1) continue;
    let score = null;
    if (s.start_time) {
      const gap = Math.abs(Date.parse(s.start_time) - start);
      if (gap <= CARDIO_WINDOW_MS) score = gap;
    } else if (String(s.date).slice(0, 10) === fields.date) {
      const diff = Math.abs((s.duration_s || 0) - fields.duration_s);
      if (diff <= Math.max(300, fields.duration_s * 0.1)) score = 1e12 + diff;
    }
    if (score !== null && (!best || score < best.score)) best = { session: s, score };
  }
  return best?.session ?? null;
}
