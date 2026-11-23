/**
 * Training load, and the fitness / fatigue / form curves built from it.
 *
 * Pure functions (no database) so they can be tested directly.
 *
 * Each session gets one load number in TRIMP units (Banister's training
 * impulse), from the best data it has:
 *   hr_detail   second-by-second heart rate (the session's HR histogram)
 *   hr_average  average heart rate × duration
 *   rpe         session RPE (average working-set RPE × minutes), converted to
 *               TRIMP units with a factor learnt from sessions that have both
 *   estimate    duration only, assumed moderate (RPE 5)
 */

import { DAY_MS, formatDay, parseDay, weekStartOf } from './cardioStats.js';
import { thresholdsOn } from './cardioAnalysis.js';

// Used when no resting heart rate is set
export const DEFAULT_RESTING_HR = 60;
// Session RPE -> TRIMP when there aren't enough sessions with both to learn it.
// An hour of lifting at RPE 7 (420) ≈ 50 TRIMP, about what a watch measures for it.
export const DEFAULT_RPE_FACTOR = 0.12;
// Sessions with both measures needed before the learnt factor is used
const MIN_CALIBRATION_SESSIONS = 3;
// RPE assumed for a session with nothing but a duration
const ESTIMATE_RPE = 5;
// Minutes per working set, for a lifting session logged without a duration
const MINUTES_PER_SET = 3;

// Time constants (days): fitness is the 42-day trend, fatigue the 7-day one
const FITNESS_DAYS = 42;
const FATIGUE_DAYS = 7;

/**
 * TRIMP for one heart rate held for some minutes. Banister's weighting:
 * minutes × reserve fraction × 0.64·e^(1.92·fraction) (men), or
 * 0.86·e^(1.67·fraction) (women).
 */
function trimpAt(bpm, minutes, { max_hr: max, resting_hr: rest }, sex) {
  const resting = rest || DEFAULT_RESTING_HR;
  if (!(max > resting) || !(minutes > 0)) return 0;
  const fraction = Math.min(1, Math.max(0, (bpm - resting) / (max - resting)));
  const weight = sex === 'F' ? 0.86 * Math.exp(1.67 * fraction) : 0.64 * Math.exp(1.92 * fraction);
  return minutes * fraction * weight;
}

/** TRIMP from a histogram [[bpm, seconds], ...]. */
export function trimpFromHistogram(histogram, settings, sex) {
  return (histogram || []).reduce((sum, [bpm, seconds]) => sum + trimpAt(bpm, seconds / 60, settings, sex), 0);
}

/** TRIMP from an average heart rate held for the whole session. */
export function trimpFromAverage(avgHr, minutes, settings, sex) {
  return trimpAt(avgHr, minutes, settings, sex);
}

/** Session minutes: the cardio duration, the workout's, the HR data's, or estimated from sets. */
export function sessionMinutes(session) {
  if (session.duration_s > 0) return session.duration_s / 60;
  if (session.duration_minutes > 0) return session.duration_minutes;
  const hrSeconds = (session.histogram || []).reduce((sum, [, s]) => sum + s, 0);
  if (hrSeconds > 0) return hrSeconds / 60;
  return (session.working_sets || 0) * MINUTES_PER_SET;
}

/** The HR-based load of a session, or null when it has no heart rate (or no settings). */
function heartRateLoad(session, settings, sex) {
  if (!settings) return null;
  if (session.histogram?.length) return { load: trimpFromHistogram(session.histogram, settings, sex), source: 'hr_detail' };
  if (session.avg_hr > 0) {
    const minutes = sessionMinutes(session);
    if (minutes > 0) return { load: trimpFromAverage(session.avg_hr, minutes, settings, sex), source: 'hr_average' };
  }
  return null;
}

/**
 * Session RPE -> TRIMP factor: the median ratio over sessions that have both
 * heart rate and RPE, once there are enough of them.
 * Returns { factor, sessions } (sessions = how many it was learnt from, 0 = default).
 */
export function calibrateRpe(sessions, thresholds, sex) {
  const ratios = [];
  for (const s of sessions) {
    if (!(s.avg_rpe > 0)) continue;
    const hr = heartRateLoad(s, thresholdsOn(thresholds, s.date), sex);
    const minutes = sessionMinutes(s);
    if (!hr || !(hr.load > 0) || !(minutes > 0)) continue;
    ratios.push(hr.load / (s.avg_rpe * minutes));
  }
  if (ratios.length < MIN_CALIBRATION_SESSIONS) return { factor: DEFAULT_RPE_FACTOR, sessions: 0 };
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return { factor: Math.min(0.5, Math.max(0.03, median)), sessions: ratios.length };
}

/**
 * Load for every session: [{ ...session, load, source }].
 * sessions: [{ date, kind, duration_s?, duration_minutes?, avg_hr?, histogram?, avg_rpe?, working_sets? }]
 */
export function sessionLoads(sessions, thresholds, sex) {
  const { factor } = calibrateRpe(sessions, thresholds, sex);
  return sessions.map((s) => {
    const hr = heartRateLoad(s, thresholdsOn(thresholds, s.date), sex);
    if (hr) return { ...s, load: hr.load, source: hr.source };
    const minutes = sessionMinutes(s);
    if (s.avg_rpe > 0 && minutes > 0) return { ...s, load: s.avg_rpe * minutes * factor, source: 'rpe' };
    return { ...s, load: ESTIMATE_RPE * minutes * factor, source: 'estimate' };
  });
}

/** Where a form value sits: 'fresh' | 'neutral' | 'productive' | 'overreaching'. */
export function formStatus(form) {
  if (form > 5) return 'fresh';
  if (form >= -10) return 'neutral';
  if (form >= -30) return 'productive';
  return 'overreaching';
}

/**
 * Fitness, fatigue and form for each day from the first session to `today`,
 * then the last `weeks` weeks returned.
 *
 * fitness_t = fitness_(t-1) + (load_t − fitness_(t-1)) / 42   (fatigue the same with 7)
 * form_t    = fitness_(t-1) − fatigue_(t-1)                     (how fresh you start the day)
 *
 * loads: sessionLoads() output. Returns {
 *   daily: [{ date, load, fitness, fatigue, form }],
 *   weekly: [{ weekStart, strength, cardio }]  load per week
 *   today: { fitness, fatigue, form, status, ratio }  ratio = fatigue / fitness (acute:chronic)
 *   sources: { hr_detail, hr_average, rpe, estimate }  sessions in the range
 * }
 */
export function fitnessCurves(loads, { today, weeks }) {
  const todayMs = parseDay(today);
  const rangeStart = weekStartOf(todayMs) - (weeks - 1) * 7 * DAY_MS;

  const byDay = new Map();
  for (const s of loads) {
    const day = parseDay(s.date);
    if (day > todayMs) continue;
    byDay.set(day, (byDay.get(day) || 0) + s.load);
  }
  const firstDay = Math.min(rangeStart, ...byDay.keys());

  const daily = [];
  let fitness = 0;
  let fatigue = 0;
  for (let day = firstDay; day <= todayMs; day += DAY_MS) {
    const load = byDay.get(day) || 0;
    const form = fitness - fatigue;
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    if (day >= rangeStart) {
      daily.push({
        date: formatDay(day),
        load: Math.round(load),
        fitness: Math.round(fitness * 10) / 10,
        fatigue: Math.round(fatigue * 10) / 10,
        form: Math.round(form * 10) / 10,
      });
    }
  }

  const weekly = new Map();
  for (let i = 0; i < weeks; i++) {
    const start = rangeStart + i * 7 * DAY_MS;
    weekly.set(start, { weekStart: formatDay(start), strength: 0, cardio: 0 });
  }
  const sources = { hr_detail: 0, hr_average: 0, rpe: 0, estimate: 0 };
  for (const s of loads) {
    const day = parseDay(s.date);
    if (day < rangeStart || day > todayMs) continue;
    weekly.get(weekStartOf(day))[s.kind === 'cardio' ? 'cardio' : 'strength'] += s.load;
    sources[s.source] += 1;
  }

  const last = daily[daily.length - 1];
  return {
    daily,
    weekly: [...weekly.values()].map((w) => ({ weekStart: w.weekStart, strength: Math.round(w.strength), cardio: Math.round(w.cardio) })),
    today: last && {
      fitness: last.fitness,
      fatigue: last.fatigue,
      form: last.form,
      status: formStatus(last.form),
      ratio: last.fitness > 0 ? Math.round((last.fatigue / last.fitness) * 100) / 100 : null,
    },
    sources,
  };
}
