/**
 * The Analytics overview: how a training period went compared with the
 * period of the same length before it.
 *
 * Pure functions (no database) so they can be tested directly. Dates are
 * 'YYYY-MM-DD', handled in UTC. Weights are in the user's own units, as
 * they were logged.
 */

import {
  calculateDots, calculateSymmetryRatios, detectImbalances, estimate1RM,
} from '../utils/strengthCalculations.js';
import { DAY_MS, activityType, formatDay, parseDay, sessionSeconds } from './cardioStats.js';
import { bestVdot, predictTime } from './cardioAnalysis.js';

export const MAIN_LIFTS = [
  { key: 'squat', name: 'Barbell Squat', label: 'Squat' },
  { key: 'bench', name: 'Barbell Bench Press', label: 'Bench press' },
  { key: 'deadlift', name: 'Barbell Deadlift', label: 'Deadlift' },
  { key: 'ohp', name: 'Barbell Overhead Press', label: 'Overhead press' },
];

const KG_PER_LB = 1 / 2.20462;
const round1 = (n) => Math.round(n * 10) / 10;

// A lift whose best hasn't improved for this long, while still being trained, is stalled
export const STALL_WEEKS = 4;
// Muscle groups checked for low weekly volume, and the level that's flagged
// (Lower Back isn't flagged: deadlifts and squats train it without many direct sets)
export const MAJOR_MUSCLE_GROUPS = ['Chest', 'Upper Back', 'Shoulders', 'Quadriceps', 'Hamstrings'];
export const LOW_SETS_PER_WEEK = 5;

/**
 * The current period (the last `weeks` weeks up to today, starting on the
 * same day as the strength-score endpoint's range) and the one before it.
 * Both bounds are inclusive.
 */
export function overviewWindows(today, weeks) {
  const end = parseDay(today);
  const start = end - weeks * 7 * DAY_MS;
  return {
    current: { start: formatDay(start), end: today },
    previous: { start: formatDay(start - weeks * 7 * DAY_MS), end: formatDay(start - DAY_MS) },
  };
}

const within = (date, w) => date >= w.start && date <= w.end;

/**
 * PRs: a working set whose estimated 1RM beats every earlier set of that
 * exercise, one per exercise per day (the best of that day), from `since` on.
 *
 * sets: [{ date, workout_id, exercise, exercise_id, weight, reps, assisted?, bodyweight? }]
 * sorted by date. Sets need positive weight, except for assisted exercises
 * (assisted: true), where any weight counts (negative = assistance) and the
 * 1RM is estimated with that day's bodyweight (see estimate1RM).
 * Returns [{ exercise, exerciseId, workoutId, weight, reps, date, estimated1RM, previousBest, firstTime }]
 */
export function findPRs(sets, since) {
  const bestBefore = new Map(); // exercise_id -> best e1RM before the current day
  const prMap = new Map();
  let dayBest = new Map();
  let currentDate = null;
  const flushDay = () => {
    for (const [exerciseId, value] of dayBest) {
      bestBefore.set(exerciseId, Math.max(bestBefore.get(exerciseId) ?? -Infinity, value));
    }
    dayBest = new Map();
  };
  for (const set of sets) {
    if (!(set.reps > 0) || !(set.weight > 0 || set.assisted)) continue;
    if (set.date !== currentDate) {
      flushDay();
      currentDate = set.date;
    }
    const e1rm = estimate1RM(set.weight, set.reps, set.bodyweight || 0);
    dayBest.set(set.exercise_id, Math.max(dayBest.get(set.exercise_id) ?? -Infinity, e1rm));
    if (set.date < since) continue;

    const previous = bestBefore.get(set.exercise_id);
    if (previous !== undefined && e1rm <= previous) continue;
    const key = `${set.exercise_id}-${set.date}`;
    const existing = prMap.get(key);
    if (!existing || e1rm > existing.estimated1RM) {
      prMap.set(key, {
        exercise: set.exercise,
        exerciseId: set.exercise_id,
        workoutId: set.workout_id,
        weight: set.weight,
        reps: set.reps,
        date: set.date,
        estimated1RM: round1(e1rm),
        previousBest: previous === undefined ? null : round1(previous),
        firstTime: previous === undefined,
      });
    }
  }
  return [...prMap.values()];
}

/** PRs in the window: how many, and the biggest jump over a previous best. */
export function summarizePRs(prs, window) {
  const inWindow = prs.filter((p) => within(p.date, window));
  const gains = inWindow
    .filter((p) => !p.firstTime && p.previousBest > 0)
    .map((p) => ({ ...p, gain: round1(p.estimated1RM - p.previousBest), gainPct: round1(((p.estimated1RM - p.previousBest) / p.previousBest) * 100) }))
    .sort((a, b) => b.gainPct - a.gainPct);
  return {
    count: inWindow.length,
    exercises: new Set(inWindow.map((p) => p.exerciseId)).size,
    biggest: gains[0] ?? null,
  };
}

/** Best estimated 1RM per session: [{ date, e1rm }] sorted by date. */
function sessionBests(sets) {
  const byWorkout = new Map();
  for (const s of sets) {
    if (!(s.weight > 0) || !(s.reps > 0)) continue;
    const e1rm = estimate1RM(s.weight, s.reps);
    const existing = byWorkout.get(s.workout_id);
    if (!existing || e1rm > existing.e1rm) byWorkout.set(s.workout_id, { date: s.date, e1rm });
  }
  return [...byWorkout.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * How one lift changed: best estimated 1RM in each window, the per-session
 * trend over the current one, and whether it has stalled.
 *
 * sets: the lift's working sets, [{ date, workout_id, weight, reps }]
 * Returns { current, previous, change, changePct, trend, sessions, status, stalledWeeks }
 *   status: 'up' | 'down' | 'flat' | 'stalled' | 'new' | 'notTrained' | 'noData'
 */
export function liftChange(sets, windows, today) {
  const sessions = sessionBests(sets);
  const inCurrent = sessions.filter((s) => within(s.date, windows.current));
  const inPrevious = sessions.filter((s) => within(s.date, windows.previous));
  const best = (list) => (list.length ? Math.max(...list.map((s) => s.e1rm)) : null);
  const current = best(inCurrent);
  const previous = best(inPrevious);

  const result = {
    current: current === null ? null : round1(current),
    previous: previous === null ? null : round1(previous),
    change: null,
    changePct: null,
    trend: inCurrent.map((s) => ({ date: s.date, e1rm: round1(s.e1rm) })),
    sessions: inCurrent.length,
    status: 'noData',
    stalledWeeks: null,
  };
  if (current === null) {
    result.status = previous === null ? 'noData' : 'notTrained';
    return result;
  }
  if (previous !== null) {
    result.change = round1(current - previous);
    result.changePct = round1(((current - previous) / previous) * 100);
  }

  // Stalled: the best over both windows was set STALL_WEEKS or more ago, and
  // the lift has been trained at least twice since without beating it
  const both = [...inPrevious, ...inCurrent];
  const top = Math.max(...both.map((s) => s.e1rm));
  const setOn = both.find((s) => s.e1rm >= top).date;
  const weeksSince = Math.floor((parseDay(today) - parseDay(setOn)) / (7 * DAY_MS));
  const sessionsSince = both.filter((s) => s.date > setOn).length;
  if (weeksSince >= STALL_WEEKS && sessionsSince >= 2) {
    result.status = 'stalled';
    result.stalledWeeks = weeksSince;
  } else if (result.change === null) {
    result.status = 'new';
  } else {
    result.status = result.change > 0 ? 'up' : result.change < 0 ? 'down' : 'flat';
  }
  return result;
}

/** Squat + bench + deadlift from the current bests, or null if one is missing. */
function totalOf(lifts, which) {
  const values = ['squat', 'bench', 'deadlift'].map((k) => lifts[k][which]);
  return values.every((v) => v > 0) ? round1(values.reduce((a, b) => a + b, 0)) : null;
}

/**
 * Powerlifting total and DOTS for both windows.
 * bodyweight: { current, previous } in the user's units (either may be null)
 */
export function totals(lifts, bodyweight, units, sex) {
  const toKg = (v) => (units === 'kg' ? v : v * KG_PER_LB);
  const current = totalOf(lifts, 'current');
  const previous = totalOf(lifts, 'previous');
  const dots = (total, bw) => (total && bw ? round1(calculateDots(toKg(total), toKg(bw), sex)) : null);
  const dotsCurrent = dots(current, bodyweight.current);
  const dotsPrevious = dots(previous, bodyweight.previous ?? bodyweight.current);
  return {
    total: { current, previous, change: current && previous ? round1(current - previous) : null },
    dots: { current: dotsCurrent, previous: dotsPrevious, change: dotsCurrent && dotsPrevious ? round1(dotsCurrent - dotsPrevious) : null },
  };
}

/**
 * Sessions, volume and time in each window.
 *
 * sessions: Cardio.sessionsSince rows ({ id, date, kind, duration_minutes, sport, duration_s, distance_m, ... })
 * volumeByWorkout: Map workout id -> working-set volume
 */
export function trainingSummary(sessions, volumeByWorkout, windows, weeks) {
  const empty = () => ({
    sessions: 0, strengthSessions: 0, cardioSessions: 0, volume: 0,
    durationS: 0, strengthDurationS: 0, cardioDurationS: 0, runDistanceM: 0,
  });
  const out = { current: empty(), previous: empty() };
  for (const s of sessions) {
    const bucket = within(s.date, windows.current) ? out.current : within(s.date, windows.previous) ? out.previous : null;
    if (!bucket) continue;
    const seconds = sessionSeconds(s);
    const type = activityType(s);
    bucket.sessions += 1;
    bucket.durationS += seconds;
    if (type === 'strength') {
      bucket.strengthSessions += 1;
      bucket.strengthDurationS += seconds;
      bucket.volume += Math.max(0, volumeByWorkout.get(s.id) ?? 0);
    } else {
      bucket.cardioSessions += 1;
      bucket.cardioDurationS += seconds;
      if (type === 'run' && s.distance_m > 0) bucket.runDistanceM += s.distance_m;
    }
  }
  for (const b of [out.current, out.previous]) {
    b.volume = Math.round(b.volume);
    b.runDistanceM = Math.round(b.runDistanceM);
    b.perWeek = round1(b.sessions / weeks);
  }
  return out;
}

/** VDOT and 10K prediction from the best effort in each window. */
export function runningChange(efforts, windows) {
  const at = (w) => {
    const best = bestVdot(efforts.filter((e) => within(String(e.date), w)));
    return best ? { vdot: best.vdot, tenK: predictTime(best.vdot, 10000) } : null;
  };
  return { current: at(windows.current), previous: at(windows.previous) };
}

/**
 * Average working sets per week for each muscle group in the window: a set
 * counts once for the exercise's primary group and half for each secondary.
 *
 * rows: [{ primary_muscle_group, secondary_muscle_groups }] one per working set
 */
export function muscleGroupSets(rows, weeks) {
  const counts = {};
  for (const row of rows) {
    if (row.primary_muscle_group) counts[row.primary_muscle_group] = (counts[row.primary_muscle_group] || 0) + 1;
    if (row.secondary_muscle_groups) {
      let secondary = [];
      try {
        secondary = JSON.parse(row.secondary_muscle_groups);
      } catch {
        secondary = String(row.secondary_muscle_groups).split(',').map((m) => m.trim());
      }
      for (const m of Array.isArray(secondary) ? secondary : []) {
        if (m) counts[m] = (counts[m] || 0) + 0.5;
      }
    }
  }
  return Object.entries(counts)
    .map(([muscleGroup, sets]) => ({ muscleGroup, setsPerWeek: round1(sets / weeks) }))
    .sort((a, b) => b.setsPerWeek - a.setsPerWeek);
}

/**
 * Things worth a look, most important first. Each flag:
 * { id, tone: 'warning' | 'success', title, detail, tab }
 * where tab is the Analytics tab with the details, or null.
 */
export function overviewFlags({ lifts, muscleGroups, summary, weeks }) {
  const flags = [];

  for (const lift of MAIN_LIFTS) {
    const l = lifts[lift.key];
    if (l.status === 'stalled') {
      flags.push({
        id: `stalled-${lift.key}`, tone: 'warning', tab: 'progression',
        title: `${lift.label} hasn't improved in ${l.stalledWeeks} weeks`,
        detail: 'Its best estimated 1RM was set a while ago. A change of rep range, a lighter week or a variation can get it moving.',
      });
    }
  }

  const current = Object.fromEntries(MAIN_LIFTS.map((l) => [l.key, lifts[l.key].current ?? 0]));
  const ratios = calculateSymmetryRatios(current);
  const imbalances = detectImbalances(ratios, current).filter((i) => i.type === 'weakness');
  imbalances.slice(0, 2).forEach((i, n) => {
    flags.push({ id: `imbalance-${n}`, tone: 'warning', tab: 'symmetry', title: i.message.replace(/\.$/, ''), detail: i.suggestion });
  });

  // Only judge weekly volume for someone lifting about once a week or more
  if (summary.current.strengthSessions >= weeks) {
    const byGroup = new Map(muscleGroups.map((m) => [m.muscleGroup, m.setsPerWeek]));
    MAJOR_MUSCLE_GROUPS
      .map((g) => ({ group: g, sets: byGroup.get(g) ?? 0 }))
      .filter((g) => g.sets < LOW_SETS_PER_WEEK)
      .sort((a, b) => a.sets - b.sets)
      .slice(0, 2)
      .forEach((g) => {
        flags.push({
          // No Analytics tab breaks volume down by muscle (the Dashboard's heatmap does)
          id: `volume-${g.group.toLowerCase().replace(/\s+/g, '-')}`, tone: 'warning', tab: null,
          title: `${g.group}: about ${Math.round(g.sets)} sets a week`,
          detail: 'Many lifters aim for 10–20 hard sets per muscle group a week.',
        });
      });
  }

  const allRatiosKnown = ['squatToDeadlift', 'benchToSquat', 'ohpToBench'].every((k) => ratios[k] > 0);
  if (allRatiosKnown && imbalances.length === 0) {
    flags.push({ id: 'balanced', tone: 'success', tab: 'symmetry', title: 'Your main lifts are in balance', detail: 'Squat, bench, deadlift and overhead press ratios are all in a healthy range.' });
  }
  const trained = MAIN_LIFTS.map((l) => lifts[l.key]).filter((l) => l.change !== null);
  const anyStalled = MAIN_LIFTS.some((l) => lifts[l.key].status === 'stalled');
  if (trained.length >= 2 && !anyStalled && trained.every((l) => l.change > 0)) {
    flags.push({ id: 'all-up', tone: 'success', tab: 'progression', title: 'Every main lift went up', detail: 'Each lift you trained beat its best from the period before.' });
  }
  return flags;
}
