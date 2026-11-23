/**
 * Training summaries across strength and cardio sessions.
 *
 * Pure functions (no database) so they can be tested directly. Dates are
 * 'YYYY-MM-DD', handled in UTC; weeks run Sunday–Saturday like the rest of
 * the app.
 */

import { EFFORT_DISTANCES, PREDICTION_DISTANCES, bestVdot, hrZones, predictTime, thresholdsOn, zoneSeconds } from './cardioAnalysis.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const parseDay = (str) => {
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const formatDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const weekStartOf = (ms) => ms - new Date(ms).getUTCDay() * DAY_MS;

// Series in the weekly time chart, in stacking order
export const ACTIVITY_TYPES = ['strength', 'run', 'ride', 'row', 'boulder', 'other'];

/** 'strength', or the cardio sport. */
export function activityType(session) {
  if (session.kind !== 'cardio') return 'strength';
  return ACTIVITY_TYPES.includes(session.sport) ? session.sport : 'other';
}

/** Seconds a session lasted, or 0 when unknown. */
export function sessionSeconds(session) {
  if (session.kind === 'cardio' && session.duration_s > 0) return session.duration_s;
  return session.duration_minutes > 0 ? session.duration_minutes * 60 : 0;
}

function emptySport(sport) {
  return {
    sport,
    sessions: 0,
    indoor: 0,
    outdoor: 0,
    duration_s: 0,
    distance_m: 0,
    // Time spent in sessions that have a distance, so pace = time / distance
    // isn't skewed by sessions without one (e.g. a treadmill run with no distance logged)
    distance_duration_s: 0,
    longest_distance_m: 0,
    longest_duration_s: 0,
    avg_hr: null,
    hr_duration_s: 0,
    hr_weighted: 0,
  };
}

function addToSport(row, session) {
  const seconds = sessionSeconds(session);
  row.sessions += 1;
  if (session.environment === 'indoor') row.indoor += 1;
  if (session.environment === 'outdoor') row.outdoor += 1;
  row.duration_s += seconds;
  row.longest_duration_s = Math.max(row.longest_duration_s, seconds);
  if (session.distance_m > 0) {
    row.distance_m += session.distance_m;
    row.distance_duration_s += seconds;
    row.longest_distance_m = Math.max(row.longest_distance_m, session.distance_m);
  }
  if (session.avg_hr > 0 && seconds > 0) {
    row.hr_weighted += session.avg_hr * seconds;
    row.hr_duration_s += seconds;
  }
}

function finishSport(row) {
  const { hr_weighted: weighted, hr_duration_s: hrSeconds, ...rest } = row;
  return {
    ...rest,
    distance_m: Math.round(rest.distance_m),
    avg_hr: hrSeconds > 0 ? Math.round(weighted / hrSeconds) : null,
  };
}

/**
 * Summarize sessions for the Endurance view.
 *
 * sessions: [{ date, kind, duration_minutes, sport?, environment?, duration_s?, distance_m?, avg_hr? }]
 * today: 'YYYY-MM-DD' (the user's today); weeks: number of weeks in the chart and totals
 *
 * Returns {
 *   weekly:   [{ weekStart, strength, run, ride, row, boulder, other }]  minutes per type
 *   thisWeek: { sessions, duration_s, byType: { [type]: { sessions, duration_s, distance_m } } }
 *   sports:   [{ sport, sessions, indoor, outdoor, duration_s, distance_m, distance_duration_s,
 *                longest_distance_m, longest_duration_s, avg_hr }]  cardio sports over the range
 *   totals:   { sessions, cardio_sessions, duration_s, cardio_duration_s }  over the range
 * }
 */
export function summarizeTraining(sessions, { today, weeks }) {
  const todayMs = parseDay(today);
  const thisWeekStart = weekStartOf(todayMs);
  const firstWeek = thisWeekStart - (weeks - 1) * 7 * DAY_MS;

  const weekly = new Map();
  for (let i = 0; i < weeks; i++) {
    const start = firstWeek + i * 7 * DAY_MS;
    weekly.set(start, { weekStart: formatDay(start), ...Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) });
  }

  const thisWeek = { sessions: 0, duration_s: 0, byType: {} };
  const sports = new Map();
  const totals = { sessions: 0, cardio_sessions: 0, duration_s: 0, cardio_duration_s: 0 };

  for (const session of sessions) {
    const day = parseDay(session.date);
    if (day < firstWeek || day > todayMs) continue;
    const type = activityType(session);
    const seconds = sessionSeconds(session);

    weekly.get(weekStartOf(day))[type] += seconds / 60;

    totals.sessions += 1;
    totals.duration_s += seconds;
    if (type !== 'strength') {
      totals.cardio_sessions += 1;
      totals.cardio_duration_s += seconds;
      if (!sports.has(type)) sports.set(type, emptySport(type));
      addToSport(sports.get(type), session);
    }

    if (day >= thisWeekStart) {
      thisWeek.sessions += 1;
      thisWeek.duration_s += seconds;
      const entry = thisWeek.byType[type] ?? (thisWeek.byType[type] = { sessions: 0, duration_s: 0, distance_m: 0 });
      entry.sessions += 1;
      entry.duration_s += seconds;
      entry.distance_m += session.kind === 'cardio' && session.distance_m > 0 ? session.distance_m : 0;
    }
  }

  return {
    weekly: [...weekly.values()].map((w) => {
      const rounded = { weekStart: w.weekStart };
      for (const t of ACTIVITY_TYPES) rounded[t] = Math.round(w[t]);
      return rounded;
    }),
    thisWeek,
    sports: ACTIVITY_TYPES.filter((t) => sports.has(t)).map((t) => finishSport(sports.get(t))),
    totals,
  };
}

// ---------------------------------------------------------------------------
// Heart rate zones over time
// ---------------------------------------------------------------------------


/**
 * Weekly time in heart rate zones, every session with second-by-second HR
 * counted with the settings in effect on its date.
 *
 * sessions: [{ date, kind, avg_hr, histogram }] (SessionAnalysis.sessionsSince)
 * thresholds: AthleteThresholds.list()
 *
 * Returns {
 *   weekly: [{ weekStart, z1..z5 }]  minutes
 *   totals: [s, s, s, s, s]           seconds over the range
 *   by_kind: { strength: [5], cardio: [5] }
 *   sessions_counted, sessions_without_detail (have average HR only)
 * }
 */
export function summarizeZones(sessions, thresholds, { today, weeks }) {
  const todayMs = parseDay(today);
  const firstWeek = weekStartOf(todayMs) - (weeks - 1) * 7 * DAY_MS;
  const weekly = new Map();
  for (let i = 0; i < weeks; i++) {
    const start = firstWeek + i * 7 * DAY_MS;
    weekly.set(start, { weekStart: formatDay(start), z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 });
  }
  const totals = [0, 0, 0, 0, 0];
  const byKind = { strength: [0, 0, 0, 0, 0], cardio: [0, 0, 0, 0, 0] };
  let counted = 0;
  let withoutDetail = 0;

  for (const session of sessions) {
    const day = parseDay(session.date);
    if (day < firstWeek || day > todayMs) continue;
    if (!session.histogram) {
      if (session.avg_hr) withoutDetail += 1;
      continue;
    }
    const settings = thresholdsOn(thresholds, session.date);
    if (!settings) continue;
    const seconds = zoneSeconds(session.histogram, hrZones(settings));
    const week = weekly.get(weekStartOf(day));
    const kind = session.kind === 'cardio' ? 'cardio' : 'strength';
    seconds.forEach((s, i) => {
      week[`z${i + 1}`] += s / 60;
      totals[i] += s;
      byKind[kind][i] += s;
    });
    counted += 1;
  }

  return {
    weekly: [...weekly.values()].map((w) => ({
      weekStart: w.weekStart, z1: Math.round(w.z1), z2: Math.round(w.z2), z3: Math.round(w.z3), z4: Math.round(w.z4), z5: Math.round(w.z5),
    })),
    totals,
    by_kind: byKind,
    sessions_counted: counted,
    sessions_without_detail: withoutDetail,
  };
}

// ---------------------------------------------------------------------------
// Running records and predictions
// ---------------------------------------------------------------------------

/**
 * efforts: [{ workout_id, effort_key, seconds, date, name }] (BestEfforts.forUser)
 * since: 'YYYY-MM-DD' start of the recent range
 *
 * Returns {
 *   records: [{ key, label, meters, best: effort|null, recent: effort|null }]  all-time and in the range
 *   vdot: { value, effort: { key, label, seconds, date, workout_id } } | null  best in the range
 *   predictions: [{ key, label, meters, seconds }]  from that VDOT
 * }
 */
export function summarizeRunning(efforts, { since }) {
  const pick = (list) => list.reduce((best, e) => (!best || e.seconds < best.seconds ? e : best), null);
  const strip = (e) => (e ? { seconds: e.seconds, date: e.date, workout_id: e.workout_id, name: e.name ?? null } : null);

  const records = EFFORT_DISTANCES.map((d) => {
    const all = efforts.filter((e) => e.effort_key === d.key);
    return {
      key: d.key, label: d.label, meters: d.meters,
      best: strip(pick(all)),
      recent: strip(pick(all.filter((e) => String(e.date) >= since))),
    };
  });

  const best = bestVdot(efforts.filter((e) => String(e.date) >= since));
  const vdotInfo = best && {
    value: best.vdot,
    effort: {
      key: best.effort.effort_key,
      label: EFFORT_DISTANCES.find((d) => d.key === best.effort.effort_key).label,
      seconds: best.effort.seconds, date: best.effort.date, workout_id: best.effort.workout_id,
    },
  };

  return {
    records,
    vdot: vdotInfo,
    predictions: vdotInfo
      ? PREDICTION_DISTANCES.map((key) => {
        const d = EFFORT_DISTANCES.find((x) => x.key === key);
        return { key, label: d.label, meters: d.meters, seconds: predictTime(vdotInfo.value, d.meters) };
      })
      : [],
  };
}
