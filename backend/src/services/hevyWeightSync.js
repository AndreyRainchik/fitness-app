import { HevyApiError } from './hevyClient.js';

/**
 * Sending bodyweight to Hevy's body measurements.
 *
 * Hevy keeps one body measurement entry per date. Creating one for a date
 * that already has an entry (e.g. logged in the Hevy app) fails with 409, and
 * updating replaces the whole entry: fields left out are set to null. So on a
 * 409 we read the existing entry and write it back with only the weight
 * changed, keeping any other measurements (body fat, waist, ...) intact.
 */

const LBS_PER_KG = 2.2046226218;

// Fields Hevy's PUT /v1/body_measurements/{date} accepts (PutBodyMeasurement)
const MEASUREMENT_FIELDS = [
  'weight_kg', 'lean_mass_kg', 'fat_percent', 'neck_cm', 'shoulder_cm', 'chest_cm',
  'left_bicep_cm', 'right_bicep_cm', 'left_forearm_cm', 'right_forearm_cm',
  'abdomen', 'waist', 'hips', 'left_thigh', 'right_thigh', 'left_calf', 'right_calf',
];

/** A bodyweight in 'kg' or 'lbs' as kilograms, to the gram. */
export function toKg(weight, units) {
  const value = Number(weight);
  const kg = units === 'kg' ? value : value / LBS_PER_KG;
  return Math.round(kg * 1000) / 1000;
}

/** Same weight to within half a gram (absorbs rounding from unit conversion). */
export function sameWeight(a, b) {
  return a !== null && a !== undefined && b !== null && b !== undefined
    && Math.abs(Number(a) - Number(b)) < 0.0005;
}

/** The entry's measurement fields with the weight replaced. */
export function mergeWeight(existing, weightKg) {
  const fields = {};
  for (const key of MEASUREMENT_FIELDS) {
    fields[key] = existing?.[key] ?? null;
  }
  fields.weight_kg = weightKg;
  return fields;
}

/**
 * Put one day's weight into Hevy.
 * Returns 'created' | 'updated' (date already had an entry) | 'unchanged'
 * (Hevy already had this weight). Throws HevyApiError on failure.
 */
export async function pushBodyweight(client, date, weightKg) {
  // The entry can be created or deleted in Hevy while we work on it, so
  // switch between create and update a couple of times before giving up
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.createBodyMeasurement({ date, weight_kg: weightKg });
      return 'created';
    } catch (error) {
      if (!(error instanceof HevyApiError) || error.status !== 409) throw error;
    }

    // 409: the date already has an entry
    const existing = await client.getBodyMeasurement(date);
    if (!existing) continue; // deleted since the 409; create it again
    if (sameWeight(existing.weight_kg, weightKg)) return 'unchanged';

    try {
      await client.updateBodyMeasurement(date, mergeWeight(existing, weightKg));
      return 'updated';
    } catch (error) {
      if (!(error instanceof HevyApiError) || error.status !== 404) throw error;
      // deleted since we read it; create it again
    }
  }
  throw new HevyApiError('Hevy kept changing this entry while we were updating it. Try again.', 409);
}

/**
 * One row per date with a bodyweight entry, newest first. The value for a
 * date is its most recent entry, since Hevy keeps one weight per date.
 *
 *   logs: bodyweight_logs rows; syncs: Map date -> { weight_kg, synced_at }
 *
 * status: 'synced' | 'not_synced' | 'changed' (edited here since it was sent)
 */
export function weightSyncStatus(logs, syncs) {
  const latestByDate = new Map();
  for (const log of logs) {
    const date = String(log.date).slice(0, 10);
    const current = latestByDate.get(date);
    if (!current || log.id > current.id) latestByDate.set(date, { ...log, date });
  }
  return [...latestByDate.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((log) => {
      const weightKg = toKg(log.weight, log.units);
      const sync = syncs.get(log.date);
      let status = 'not_synced';
      if (sync) status = sameWeight(sync.weight_kg, weightKg) ? 'synced' : 'changed';
      return {
        date: log.date,
        log_id: log.id,
        weight: log.weight,
        units: log.units,
        weight_kg: weightKg,
        status,
        synced_at: sync?.synced_at ?? null,
      };
    });
}
