import { all, get, run, transaction } from '../config/database.js';
import { Cardio, Workout } from '../models/index.js';
import { saveMetrics } from '../models/Cardio.js';
import { StravaActivities, StravaConnection } from '../models/Strava.js';
import { StravaApiError, StravaClient, refreshTokens } from './stravaClient.js';
import {
  cardioFields, classifyActivity, findCardioDuplicate, ledgerFields, matchStrengthWorkout,
} from './stravaImport.js';
import { SessionAnalysis } from '../models/Analysis.js';
import { bestEfforts, hrHistogram, streamFromStrava } from './cardioAnalysis.js';
import { readStream, removeStream, saveStream } from './streamStore.js';

/**
 * Brings Strava activities into the app.
 *
 *   syncStrava(userId)          new activities since the last sync, then
 *                               another stretch of older history
 *   handleWebhookEvent(event)   one activity created / updated / deleted on Strava
 *   linkUnmatchedStrength(id)   retry matching Strava lifting sessions to workouts
 *   ensureAnalysis(user, id)    fetch and analyse a session's second-by-second
 *                               data now, if it hasn't been
 *
 * Work for one user runs one piece at a time (a webhook event waits for a
 * running sync), so the same activity is never imported twice.
 */

const DAY_S = 24 * 60 * 60;
// How far back the first sync looks in detail (older history comes from the backfill)
const FIRST_SYNC_DAYS = 30;
// New activities whose details are fetched per sync (one request each); the
// rest are imported from the activity list and still get HR and distance
const DETAIL_LIMIT = Number(process.env.STRAVA_DETAIL_LIMIT) || 25;
// Pages of older history (200 activities each) walked per sync
const BACKFILL_PAGES = Number(process.env.STRAVA_BACKFILL_PAGES) || 10;
// Older sessions whose second-by-second data is fetched per sync (one request each)
const STREAM_LIMIT = Number(process.env.STRAVA_STREAM_LIMIT) || 20;

const queues = new Map();

/** Run fn after any earlier work for this user has finished. */
function exclusive(userId, fn) {
  const previous = queues.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(fn);
  queues.set(userId, next);
  next.finally(() => { if (queues.get(userId) === next) queues.delete(userId); }).catch(() => {});
  return next;
}

export class StravaNotConnectedError extends Error {}

/** A client with a valid access token, refreshing it first when it's about to expire. */
async function clientFor(userId) {
  const tokens = StravaConnection.tokens(userId);
  if (!tokens) throw new StravaNotConnectedError('Strava is not connected');
  if (tokens.expiresAt - 300 > Date.now() / 1000) return new StravaClient(tokens.accessToken);

  const fresh = await refreshTokens(tokens.refreshToken);
  StravaConnection.updateTokens(userId, fresh);
  return new StravaClient(fresh.accessToken);
}

/**
 * True when Strava rejects this user's tokens (access revoked on strava.com).
 * A refresh that fails with 400/401 means the refresh token was revoked too.
 */
async function accessRevoked(userId) {
  try {
    const client = await clientFor(userId);
    await client.getAthlete();
    return false;
  } catch (error) {
    if (error instanceof StravaNotConnectedError) return false;
    return error instanceof StravaApiError && (error.status === 401 || error.status === 400);
  }
}

// ---------------------------------------------------------------------------
// One activity
// ---------------------------------------------------------------------------

/** Strength workouts near a date that no Strava activity is linked to yet. */
function strengthCandidates(userId, date) {
  const linked = StravaActivities.linkedWorkoutIds(userId);
  return all(
    `SELECT id, date, start_time, duration_minutes FROM workouts
     WHERE user_id = ? AND kind = 'strength' AND date BETWEEN date(?, '-1 day') AND date(?, '+1 day')`,
    [userId, date, date]
  ).filter((w) => !linked.has(w.id));
}

/** Cardio sessions near a date that no Strava activity is linked to yet. */
function cardioCandidates(userId, date) {
  const linked = StravaActivities.linkedWorkoutIds(userId);
  return all(
    `SELECT w.id, w.date, w.start_time, w.name, w.notes, cs.sport, cs.duration_s
     FROM workouts w JOIN cardio_sessions cs ON cs.workout_id = w.id
     WHERE w.user_id = ? AND w.kind = 'cardio' AND w.date BETWEEN date(?, '-1 day') AND date(?, '+1 day')`,
    [userId, date, date]
  ).filter((w) => !linked.has(w.id));
}

const workoutExists = (id, kind) => Boolean(id && get('SELECT id FROM workouts WHERE id = ? AND kind = ?', [id, kind]));

/**
 * Import, link or update one activity. Returns what happened:
 * 'imported' | 'linked' | 'updated' | 'unmatched' | 'seen' | 'dismissed'.
 *
 * force: re-apply an activity seen before (a webhook update). Without it an
 * activity already in the ledger is left alone, unless this is the detailed
 * version of one imported from the activity list.
 */
function applyActivity(userId, activity, { detailed, force = false }) {
  return transaction(() => {
    const existing = StravaActivities.find(userId, activity.id);
    // Seen before: only re-apply when asked, or to add details to a summary import
    if (existing && !force && !(detailed && !existing.detailed)) return 'seen';

    const base = ledgerFields(activity, { detailed: detailed || Boolean(existing?.detailed) });
    if (existing?.outcome === 'dismissed') {
      StravaActivities.record(userId, { ...base, outcome: 'dismissed' });
      return 'dismissed';
    }

    const kind = classifyActivity(activity);
    const linkedCardio = existing?.outcome === 'cardio' && workoutExists(existing.workout_id, 'cardio') ? existing.workout_id : null;
    const linkedStrength = existing?.outcome === 'strength_linked' && workoutExists(existing.workout_id, 'strength') ? existing.workout_id : null;

    if (kind.kind === 'cardio') {
      // Changed from a lifting session on Strava: take its HR off the workout
      if (linkedStrength) {
        saveMetrics(linkedStrength, {});
        dropAnalysis(linkedStrength);
      }
      const fields = cardioFields(activity, kind);
      let workoutId;
      let outcome;
      if (linkedCardio) {
        const current = Workout.findById(linkedCardio);
        Cardio.update(linkedCardio, { ...fields, notes: fields.notes ?? current.notes });
        workoutId = linkedCardio;
        outcome = 'updated';
      } else {
        const duplicate = findCardioDuplicate(fields, cardioCandidates(userId, fields.date));
        if (duplicate) {
          // Logged here by hand first: keep its name and notes, take Strava's numbers
          Cardio.update(duplicate.id, { ...fields, name: duplicate.name ?? fields.name, notes: duplicate.notes ?? fields.notes ?? null });
          workoutId = duplicate.id;
          outcome = 'linked';
        } else {
          workoutId = Cardio.create(userId, { ...fields, notes: fields.notes ?? null, splits_json: fields.splits_json ?? null }).id;
          outcome = 'imported';
        }
      }
      StravaActivities.record(userId, { ...base, outcome: 'cardio', workout_id: workoutId });
      return outcome;
    }

    // A lifting session. Changed from cardio on Strava: drop the session imported from it
    if (linkedCardio) Workout.delete(linkedCardio);
    const target = linkedStrength
      ?? matchStrengthWorkout(base, strengthCandidates(userId, String(base.start_date_local || base.start_date).slice(0, 10)))?.id;
    if (target) {
      saveMetrics(target, base);
      StravaActivities.record(userId, { ...base, outcome: 'strength_linked', workout_id: target });
      fillStrengthDurations(userId);
      return linkedStrength ? 'updated' : 'linked';
    }
    StravaActivities.record(userId, { ...base, outcome: 'strength_unmatched' });
    return 'unmatched';
  });
}

// ---------------------------------------------------------------------------
// Second-by-second data
// ---------------------------------------------------------------------------

const CARDIO_STREAM_KEYS = ['time', 'distance', 'heartrate', 'velocity_smooth', 'altitude', 'cadence', 'latlng'];
const STRENGTH_STREAM_KEYS = ['time', 'heartrate'];

function dropAnalysis(workoutId) {
  SessionAnalysis.remove(workoutId);
  removeStream(workoutId);
}

/**
 * Analyse a stored or fresh stream for a workout: HR histogram for any
 * session, best efforts for outdoor runs (treadmill distance is the watch's
 * estimate, so it doesn't set records).
 */
function analyse(workoutId, stream) {
  const session = get(
    `SELECT w.kind, cs.sport, cs.environment FROM workouts w LEFT JOIN cardio_sessions cs ON cs.workout_id = w.id WHERE w.id = ?`,
    [workoutId]
  );
  if (!session) return;
  const runOutdoors = session.kind === 'cardio' && session.sport === 'run' && session.environment === 'outdoor';
  SessionAnalysis.save(workoutId, { histogram: hrHistogram(stream), efforts: runOutdoors ? bestEfforts(stream) : {} });
}

/** Fetch, store and analyse the streams of the activity linked to a workout. */
async function fetchAnalysis(client, workoutId, activityId) {
  const kind = get('SELECT kind FROM workouts WHERE id = ?', [workoutId])?.kind;
  if (!kind) return;
  let stream = null;
  try {
    stream = streamFromStrava(await client.getStreams(activityId, kind === 'cardio' ? CARDIO_STREAM_KEYS : STRENGTH_STREAM_KEYS));
  } catch (error) {
    if (!(error instanceof StravaApiError && error.status === 404)) throw error;
  }
  if (!stream) {
    SessionAnalysis.markNone(workoutId);
    return;
  }
  saveStream(workoutId, stream);
  analyse(workoutId, stream);
}

/** After an activity was applied: analyse its workout if that hasn't been done. */
async function analyseActivity(userId, client, activityId) {
  const row = StravaActivities.find(userId, activityId);
  if (!row?.workout_id || !['cardio', 'strength_linked'].includes(row.outcome)) return;
  if (SessionAnalysis.find(row.workout_id)) {
    // Already fetched: re-analyse in case the sport or indoor/outdoor changed
    const stream = readStream(row.workout_id);
    if (stream) analyse(row.workout_id, stream);
    return;
  }
  await fetchAnalysis(client, row.workout_id, row.activity_id);
}

/** Workouts linked to Strava without analysis yet, outdoor runs first, newest first. */
function sessionsNeedingAnalysis(userId, limit) {
  return all(
    `SELECT sa.activity_id, sa.workout_id
     FROM strava_activities sa
     JOIN workouts w ON w.id = sa.workout_id
     LEFT JOIN cardio_sessions cs ON cs.workout_id = w.id
     LEFT JOIN session_analysis an ON an.workout_id = w.id
     WHERE sa.user_id = ? AND sa.outcome IN ('cardio', 'strength_linked') AND an.workout_id IS NULL
     ORDER BY (cs.sport = 'run' AND cs.environment = 'outdoor') DESC, w.date DESC
     LIMIT ?`,
    [userId, limit]
  );
}

/**
 * Make sure a workout's second-by-second data has been looked for, fetching
 * it now when it's linked to Strava. Resolves 'ok' | 'none' | 'unavailable'
 * (not from Strava, or Strava not connected) | 'rate_limited'.
 */
export function ensureAnalysis(userId, workoutId) {
  const existing = SessionAnalysis.find(workoutId);
  if (existing) return Promise.resolve(existing.status);
  const link = StravaActivities.forWorkout(workoutId);
  if (!link || !StravaConnection.find(userId)) return Promise.resolve('unavailable');

  return exclusive(userId, async () => {
    if (!SessionAnalysis.find(workoutId)) {
      try {
        await fetchAnalysis(await clientFor(userId), workoutId, link.activity_id);
      } catch (error) {
        if (error instanceof StravaApiError && error.rateLimited) return 'rate_limited';
        if (error instanceof StravaApiError || error instanceof StravaNotConnectedError) return 'unavailable';
        throw error;
      }
    }
    return SessionAnalysis.find(workoutId)?.status ?? 'unavailable';
  });
}

/** An activity was deleted on Strava: remove what it brought here. */
function removeActivity(userId, activityId) {
  transaction(() => {
    const existing = StravaActivities.find(userId, activityId);
    if (!existing) return;
    if (existing.outcome === 'cardio' && workoutExists(existing.workout_id, 'cardio')) {
      Workout.delete(existing.workout_id);
    } else if (existing.outcome === 'strength_linked' && existing.workout_id) {
      saveMetrics(existing.workout_id, {});
      dropAnalysis(existing.workout_id);
    }
    StravaActivities.remove(userId, activityId);
  });
}

/**
 * Lifting workouts with no duration take it from their Strava activity
 * (elapsed time: a lifting session's "moving time" is mostly rest). A
 * duration already there, from Hevy or typed in, is kept.
 */
function fillStrengthDurations(userId) {
  const linked = `SELECT CAST(ROUND(sa.elapsed_s / 60.0) AS INTEGER) FROM strava_activities sa
    WHERE sa.workout_id = workouts.id AND sa.outcome = 'strength_linked' AND sa.elapsed_s >= 60 LIMIT 1`;
  run(
    `UPDATE workouts SET duration_minutes = (${linked})
     WHERE user_id = ? AND kind = 'strength' AND (duration_minutes IS NULL OR duration_minutes <= 0)
       AND (${linked}) IS NOT NULL`,
    [userId]
  );
}

/**
 * Match Strava lifting sessions that had no workout here yet (e.g. the Hevy
 * import came later), and fill in missing durations. Returns how many were
 * linked. Database only.
 */
export function linkUnmatchedStrength(userId) {
  let linked = 0;
  transaction(() => {
    for (const row of StravaActivities.unmatchedStrength(userId)) {
      const date = String(row.start_date_local || row.start_date).slice(0, 10);
      const target = matchStrengthWorkout(row, strengthCandidates(userId, date));
      if (!target) continue;
      saveMetrics(target.id, row);
      StravaActivities.record(userId, { ...row, outcome: 'strength_linked', workout_id: target.id });
      linked += 1;
    }
    fillStrengthDurations(userId);
  });
  return linked;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const epochOf = (activity) => Math.floor(Date.parse(activity.start_date) / 1000);

async function runSync(userId) {
  const result = { imported: 0, linked: 0, updated: 0, unmatched: 0, analysed: 0, rate_limited: false, error: null };
  const count = (outcome) => { if (result[outcome] !== undefined) result[outcome] += 1; };

  try {
    const client = await clientFor(userId);
    const conn = StravaConnection.find(userId);
    const now = Math.floor(Date.now() / 1000);

    // 1. New activities: everything since a few days before the newest one seen
    const after = conn.last_activity_epoch ? conn.last_activity_epoch - 3 * DAY_S : now - FIRST_SYNC_DAYS * DAY_S;
    let newest = conn.last_activity_epoch ?? 0;
    let details = 0;
    for (let page = 1; ; page++) {
      const activities = await client.listActivities({ after, page });
      for (const summary of activities) {
        newest = Math.max(newest, epochOf(summary));
        if (StravaActivities.find(userId, summary.id)) continue;
        let activity = summary;
        if (details < DETAIL_LIMIT) {
          activity = await client.getActivity(summary.id);
          details += 1;
        }
        count(applyActivity(userId, activity, { detailed: activity !== summary }));
        // New activities get their second-by-second data straight away
        if (activity !== summary) await analyseActivity(userId, client, summary.id);
      }
      if (activities.length < 200) break;
    }
    StravaConnection.updateProgress(userId, { last_activity_epoch: newest || null, last_synced_at: new Date().toISOString() });

    // 2. Older history, walking backwards a page at a time, from the activity list only
    let { backfill_before: before, backfill_done: done } = StravaConnection.find(userId);
    before = before ?? after + 1;
    for (let page = 0; !done && page < BACKFILL_PAGES; page++) {
      const activities = await client.listActivities({ before, page: 1 });
      for (const summary of activities) count(applyActivity(userId, summary, { detailed: false }));
      if (activities.length) before = Math.min(...activities.map(epochOf));
      done = activities.length < 200 ? 1 : 0;
      StravaConnection.updateProgress(userId, { backfill_before: before, backfill_done: done });
    }

    // 3. Second-by-second data for older sessions, a few per sync
    for (const { activity_id: activityId, workout_id: workoutId } of sessionsNeedingAnalysis(userId, STREAM_LIMIT)) {
      await fetchAnalysis(client, workoutId, activityId);
      result.analysed += 1;
    }
  } catch (error) {
    if (error instanceof StravaApiError && error.rateLimited) {
      result.rate_limited = true;
    } else if (error instanceof StravaApiError || error instanceof StravaNotConnectedError) {
      result.error = error.message;
    } else {
      throw error;
    }
  }

  result.linked += linkUnmatchedStrength(userId);
  return result;
}

/**
 * Sync one user. Resolves { imported, linked, updated, unmatched, analysed,
 * rate_limited, error }; Strava errors are reported in `error`, not thrown.
 */
export function syncStrava(userId) {
  return exclusive(userId, () => runSync(userId));
}

/**
 * Handle one webhook event from Strava. Never throws.
 * https://developers.strava.com/docs/webhooks/
 */
export async function handleWebhookEvent(event) {
  try {
    const conn = StravaConnection.findByAthlete(event?.owner_id);
    if (!conn) return;
    const userId = conn.user_id;

    if (event.object_type === 'athlete') {
      // The athlete revoked access on strava.com. Events aren't signed and
      // athlete ids are public, so only disconnect once Strava itself stops
      // accepting our tokens.
      if (String(event.updates?.authorized) === 'false') {
        await exclusive(userId, async () => {
          if (await accessRevoked(userId)) StravaConnection.remove(userId);
        });
      }
      return;
    }
    if (event.object_type !== 'activity' || !event.object_id) return;

    await exclusive(userId, async () => {
      const client = await clientFor(userId);
      if (event.aspect_type === 'delete') {
        // Events aren't signed, so check with Strava that it's really gone
        try {
          await client.getActivity(event.object_id);
          return;
        } catch (error) {
          if (!(error instanceof StravaApiError && error.status === 404)) throw error;
        }
        removeActivity(userId, event.object_id);
        return;
      }
      let activity;
      try {
        activity = await client.getActivity(event.object_id);
      } catch (error) {
        // Made private beyond the granted scope, or deleted since: nothing to import
        if (error instanceof StravaApiError && error.status === 404) return;
        throw error;
      }
      applyActivity(userId, activity, { detailed: true, force: event.aspect_type === 'update' });
      await analyseActivity(userId, client, event.object_id);
    });
  } catch (error) {
    console.error('Strava webhook error:', error.message);
  }
}
