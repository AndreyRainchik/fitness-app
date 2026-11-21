import { BodyweightLog } from '../models/index.js';
import { HevyConnection, HevyWeightSyncs } from '../models/Hevy.js';
import { HevyApiError, HevyClient } from './hevyClient.js';
import { pushBodyweight, sameWeight, toKg } from './hevyWeightSync.js';

/**
 * Sends bodyweight to Hevy automatically when an entry is added, edited or
 * deleted here. Never throws: Hevy being down or slow must not stop the
 * bodyweight entry from saving. A date that fails stays "not in Hevy" and can
 * be sent later from Profile > Bodyweight.
 */

// How long the bodyweight request waits for Hevy before answering without it
const WAIT_MS = Number(process.env.HEVY_AUTO_SYNC_WAIT_MS) || 4000;

/** The entry Hevy should have for a date: the latest one logged. */
function latestForDate(userId, date) {
  return BodyweightLog.getByUser(userId)
    .filter((log) => String(log.date).slice(0, 10) === date)
    .reduce((latest, log) => (!latest || log.id > latest.id ? log : latest), null);
}

async function sendDate(client, userId, date) {
  const log = latestForDate(userId, date);
  if (!log) return { date, outcome: 'no_entry' }; // nothing left to send for this date

  const weightKg = toKg(log.weight, log.units);
  const previous = HevyWeightSyncs.getForUser(userId).get(date);
  if (previous && sameWeight(previous.weight_kg, weightKg)) return { date, outcome: 'unchanged' };

  try {
    const outcome = await pushBodyweight(client, date, weightKg);
    HevyWeightSyncs.record(userId, date, weightKg, new Date().toISOString());
    return { date, outcome };
  } catch (error) {
    if (!(error instanceof HevyApiError)) console.error('Hevy auto-sync error:', error);
    return { date, outcome: 'failed', error: error instanceof HevyApiError ? error.message : 'Failed to send to Hevy' };
  }
}

/**
 * Send these dates' bodyweight to Hevy if the user has connected Hevy.
 *
 * Resolves within WAIT_MS with one of:
 *   { status: 'not_connected' }
 *   { status: 'done', results: [{ date, outcome, error? }] }  outcome: created|updated|unchanged|failed|no_entry
 *   { status: 'pending' }  Hevy is slow; the send carries on in the background
 */
export async function autoSendBodyweightToHevy(userId, dates) {
  try {
    const apiKey = HevyConnection.apiKey(userId);
    if (!apiKey) return { status: 'not_connected' };

    const client = new HevyClient(apiKey);
    const unique = [...new Set(dates.filter(Boolean).map((d) => String(d).slice(0, 10)))];

    const work = (async () => {
      const results = [];
      for (const date of unique) results.push(await sendDate(client, userId, date));
      return { status: 'done', results };
    })().catch((error) => {
      console.error('Hevy auto-sync error:', error);
      return { status: 'done', results: unique.map((date) => ({ date, outcome: 'failed', error: 'Failed to send to Hevy' })) };
    });

    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'pending' }), WAIT_MS); });
    const result = await Promise.race([work, timeout]);
    clearTimeout(timer);
    return result;
  } catch (error) {
    console.error('Hevy auto-sync error:', error);
    return { status: 'done', results: [{ outcome: 'failed', error: 'Failed to send to Hevy' }] };
  }
}
