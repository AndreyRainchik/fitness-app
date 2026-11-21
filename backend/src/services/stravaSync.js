import { all, get, transaction } from '../config/database.js';
import { Cardio, Workout } from '../models/index.js';
import { saveMetrics } from '../models/Cardio.js';
import { StravaActivities, StravaConnection } from '../models/Strava.js';
import { StravaApiError, StravaClient, refreshTokens } from './stravaClient.js';
import {
  cardioFields, classifyActivity, findCardioDuplicate, ledgerFields, matchStrengthWorkout,
} from './stravaImport.js';

/**
 * Brings Strava activities into the app.
 *
 *   syncStrava(userId)          new activities since the last sync, then
 *                               another stretch of older history
 *   handleWebhookEvent(event)   one activity created / updated / deleted on Strava
 *   linkUnmatchedStrength(id)   retry matching Strava lifting sessions to workouts
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
      if (linkedStrength) saveMetrics(linkedStrength, {});
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
      return linkedStrength ? 'updated' : 'linked';
    }
    StravaActivities.record(userId, { ...base, outcome: 'strength_unmatched' });
    return 'unmatched';
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
    }
    StravaActivities.remove(userId, activityId);
  });
}

/**
 * Match Strava lifting sessions that had no workout here yet (e.g. the Hevy
 * import came later). Returns how many were linked. Database only.
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
  });
  return linked;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const epochOf = (activity) => Math.floor(Date.parse(activity.start_date) / 1000);

async function runSync(userId) {
  const result = { imported: 0, linked: 0, updated: 0, unmatched: 0, rate_limited: false, error: null };
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
 * Sync one user. Resolves { imported, linked, updated, unmatched,
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
      // The athlete revoked access on strava.com
      if (String(event.updates?.authorized) === 'false') StravaConnection.remove(userId);
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
    });
  } catch (error) {
    console.error('Strava webhook error:', error.message);
  }
}
