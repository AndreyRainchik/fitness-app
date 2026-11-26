import { get } from '../config/database.js';
import { convertWeight } from '../utils/units.js';
import { isAssistedExercise } from '../utils/bulkSets.js';

/**
 * Bodyweight for assisted exercises. Their sets are logged relative to
 * bodyweight (negative = machine assistance), so estimating a 1RM needs the
 * lifter's bodyweight on the day (see estimate1RM).
 */

/** True for an exercise name that is logged as assistance (contains "assisted"). */
export function isAssistedName(name) {
  return Boolean(isAssistedExercise({ name: name || '' }));
}

/**
 * A lookup for one user: bodyweightFor(exerciseName, date) is their
 * bodyweight on that date in their own units (the unit their sets are
 * logged in) when the exercise is assisted, else 0, so it can be passed
 * straight to estimate1RM. The bodyweight on a date is the latest weigh-in
 * on or before it, else the earliest one after it, else the profile
 * bodyweight; 0 when there's none. Dates are looked up once each.
 */
export function assistedBodyweightLookup(userId) {
  const profile = get('SELECT bodyweight, units FROM users WHERE id = ?', [userId]) || {};
  const units = profile.units === 'kg' ? 'kg' : 'lbs';
  const byDate = new Map();

  const bodyweightOn = (date) => {
    if (byDate.has(date)) return byDate.get(date);
    const log = get(
      'SELECT weight, units FROM bodyweight_logs WHERE user_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1',
      [userId, date]
    ) || get(
      'SELECT weight, units FROM bodyweight_logs WHERE user_id = ? AND date > ? ORDER BY date ASC, id ASC LIMIT 1',
      [userId, date]
    );
    const weight = log
      ? Number(convertWeight(log.weight, log.units || units, units)) || 0
      : Number(profile.bodyweight) || 0;
    byDate.set(date, weight);
    return weight;
  };

  return {
    units,
    bodyweightOn,
    bodyweightFor: (exerciseName, date) => (isAssistedName(exerciseName) ? bodyweightOn(date) : 0),
  };
}
