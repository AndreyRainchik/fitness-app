/**
 * Run plan generator: race plans and maintenance plans, built around the
 * athlete's lifting. Pure functions, deterministic: the same inputs always
 * give the same plan.
 *
 * Coaching rules: docs/plans/run-sessions.md. Session library: runSessions.js.
 * Paces: runPaces.js. Dates are 'YYYY-MM-DD' in UTC; weeks run Sunday–Saturday.
 */

import { DAY_MS, formatDay, parseDay, weekStartOf } from './cardioStats.js';
import { RACE_DISTANCES, paceZones, typicalPace } from './runPaces.js';
import { SESSIONS, sessionById } from './runSessions.js';

const MILE = 1609.344;

// ---------------------------------------------------------------------------
// Plan shape
// ---------------------------------------------------------------------------

/** Default plan shape per race: weeks of base, build and peak, then taper (race week included). */
export const PLAN_SHAPES = {
  '5k': { base: 2, build: 3, peak: 2, taper: 1, minWeeks: 4 },
  '10k': { base: 3, build: 3, peak: 3, taper: 1, minWeeks: 5 },
  half: { base: 3, build: 4, peak: 3, taper: 2, minWeeks: 6 },
  marathon: { base: 4, build: 5, peak: 5, taper: 3, minWeeks: 8 },
};
const EXTRA_BASE_WEEKS = 6;

// Weekly distance at the peak: the start times a race-specific factor, within limits (km).
// Reaching it is still bound by the 10%-a-week rule.
const PEAK_FACTOR = { '5k': 1.3, '10k': 1.4, half: 1.5, marathon: 1.8, maintain: 1 };
const PEAK_KM = { '5k': [25, 70], '10k': [30, 80], half: [40, 90], marathon: [60, 110], maintain: [0, 200] };
// Long run as a share of the week, and its cap in metres
const LONG_SHARE = { '5k': 0.28, '10k': 0.28, half: 0.3, marathon: 0.33, maintain: 0.28 };
const LONG_CAP = { '5k': 16000, '10k': 19000, half: 21000, marathon: 35000, maintain: 19000 };
// The long run a race needs by the peak (10 mi for a half, 18 mi for a marathon), reached
// gradually and never more than 40% of the week
const LONG_TARGET = { '5k': 13000, '10k': 16000, half: 18000, marathon: 32000, maintain: 0 };
const LONG_MAX_SHARE = 0.4;
const LONG_MAX_SHARE_MARATHON = 0.45;
const maxLongShare = (raceKey) => (raceKey === 'marathon' ? LONG_MAX_SHARE_MARATHON : LONG_MAX_SHARE);
// Taper long runs as a share of the peak long run (the race week has none)
const TAPER_LONG = { '5k': [], '10k': [], half: [0.7], marathon: [0.75, 0.55] };
// Taper weeks as a share of the last full week (race week excludes the race itself)
const TAPER = { '5k': [0.6], '10k': [0.6], half: [0.8, 0.55], marathon: [0.8, 0.65, 0.45] };

const CUTBACK_SHARE = 0.8;
const MAX_WEEKLY_GROWTH = 1.1;
const MAX_LONG_GROWTH_M = 2500;

/**
 * Split `weeks` into phases. Extra weeks go to base; with fewer weeks, base is
 * cut first, then build, then peak, never below one week each (where possible).
 * Returns ['base', 'base', 'build', ..., 'taper'] (length `weeks`).
 */
export function phasesFor(raceKey, weeks) {
  const shape = PLAN_SHAPES[raceKey];
  const counts = { base: shape.base, build: shape.build, peak: shape.peak };
  let available = weeks - shape.taper;
  let total = counts.base + counts.build + counts.peak;
  if (available > total) counts.base += available - total;
  for (const phase of ['base', 'build', 'peak']) {
    while (total > available && counts[phase] > (phase === 'base' ? 0 : 1)) {
      counts[phase] -= 1;
      total -= 1;
    }
  }
  return [
    ...Array(counts.base).fill('base'),
    ...Array(counts.build).fill('build'),
    ...Array(counts.peak).fill('peak'),
    ...Array(shape.taper).fill('taper'),
  ];
}

/**
 * Which weeks are easier ("cutback"). Lines up with the lifting deload weeks
 * when the program has them (5/3/1 week 4), else every 4th week; never the
 * first week, never in the taper, never within 3 weeks of another.
 */
export function cutbackWeeks(phases, weekStarts, deloadWeekStarts = new Set()) {
  const cutbacks = new Set();
  // Not the first week, not in the taper, and not the week before it (the taper is the easing off)
  const eligible = (i) => i > 0 && phases[i] !== 'taper' && phases[i] !== 'race' && phases[i + 1] !== 'taper';
  const farEnough = (i) => [...cutbacks].every((j) => Math.abs(i - j) >= 3);
  if (deloadWeekStarts.size) {
    weekStarts.forEach((start, i) => {
      if (deloadWeekStarts.has(start) && eligible(i) && farEnough(i)) cutbacks.add(i);
    });
    // A long stretch without a deload (program not running) still gets a cutback
    for (let i = 0; i < phases.length; i++) {
      if (eligible(i) && farEnough(i) && [...cutbacks].every((j) => Math.abs(i - j) >= 4) && i >= 3) {
        const recent = [...cutbacks].filter((j) => j < i);
        if (!recent.length ? i === 3 : i - Math.max(...recent) >= 4) cutbacks.add(i);
      }
    }
  } else {
    for (let i = 3; i < phases.length; i += 4) if (eligible(i)) cutbacks.add(i);
  }
  return cutbacks;
}

/** Weekly distance targets (metres), one per week. */
export function weeklyTargets({ raceKey, phases, cutbacks, startWeekly, runsPerWeek }) {
  const floor = runsPerWeek * 4000;
  const start = Math.max(startWeekly || runsPerWeek * 5000, floor);
  const [minPeak, maxPeak] = PEAK_KM[raceKey].map((km) => km * 1000);
  const peak = raceKey === 'maintain' ? start : Math.max(start, Math.min(Math.max(start * PEAK_FACTOR[raceKey], minPeak), maxPeak));
  const taper = TAPER[raceKey] ?? [];
  const firstTaper = phases.indexOf('taper');

  const targets = [];
  let current = start;
  let lastFull = start;
  phases.forEach((phase, i) => {
    if (phase === 'taper') {
      targets.push(lastFull * (taper[i - firstTaper] ?? taper[taper.length - 1] ?? 0.6));
      return;
    }
    if (cutbacks.has(i)) {
      targets.push(current * CUTBACK_SHARE);
      return;
    }
    targets.push(current);
    lastFull = current;
    current = Math.min(current * MAX_WEEKLY_GROWTH, peak);
  });
  return targets.map(Math.round);
}

/**
 * Long run distance per week (metres). Builds evenly from the athlete's
 * current long run to the race's peak long run by the last peak week, never
 * more than 2.5 km longer than the last full week and never more than 40% of
 * the week. Cutback weeks drop to 75% of the last full long run; taper weeks
 * step down; maintenance holds steady.
 */
export function longRunTargets({ raceKey, phases, cutbacks, targets, baseline = {}, runsPerWeek }) {
  const share = LONG_SHARE[raceKey] + (runsPerWeek <= 3 ? 0.05 : 0);
  const cap = LONG_CAP[raceKey];
  const full = phases.map((p, i) => !cutbacks.has(i) && p !== 'taper' && p !== 'race');
  const fullIndexes = full.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  const maxTarget = Math.max(...targets);
  const maxShare = maxLongShare(raceKey);
  const start = Math.min(Math.max(baseline.longest_m || 0, targets[0] * share), targets[0] * maxShare, cap);
  const peak = raceKey === 'maintain'
    ? start
    : Math.max(start, Math.min(cap, Math.max(LONG_TARGET[raceKey], maxTarget * share), maxTarget * maxShare));

  const result = [];
  let lastFull = start;
  let peakReached = start;
  let taperWeek = 0;
  phases.forEach((phase, i) => {
    if (phase === 'taper') {
      const shares = TAPER_LONG[raceKey] ?? [];
      result.push(peakReached * (shares[taperWeek] ?? shares[shares.length - 1] ?? 0.5));
      taperWeek += 1;
      return;
    }
    if (!full[i]) {
      result.push(lastFull * 0.75);
      return;
    }
    const k = fullIndexes.indexOf(i);
    const planned = start + (peak - start) * (fullIndexes.length > 1 ? k / (fullIndexes.length - 1) : 1);
    const value = Math.min(planned, k === 0 ? planned : lastFull + MAX_LONG_GROWTH_M, Math.max(targets[i] * maxShare, start), cap);
    result.push(value);
    lastFull = value;
    peakReached = Math.max(peakReached, value);
  });
  return result.map(Math.round);
}

// ---------------------------------------------------------------------------
// Distances and volume caps
// ---------------------------------------------------------------------------

const RECOVERY_ZONE = { jog: 'recovery', float: 'float' };
const WALK_SPEED = 1.4; // m/s

function amountDistance(amount, zone, zones) {
  if (amount.distance_m) return amount.distance_m;
  if (amount.duration_s) return (amount.duration_s / typicalPace(zones, zone)) * 1000;
  return 0;
}

function recoveryDistance(recovery, zones) {
  if (!recovery || recovery.kind === 'none') return 0;
  if (recovery.kind === 'walk') return recovery.distance_m ?? (recovery.duration_s ?? 0) * WALK_SPEED;
  return amountDistance(recovery, RECOVERY_ZONE[recovery.kind] ?? 'recovery', zones);
}

/** Metres a step covers. */
export function stepDistance(step, zones) {
  if (step.kind === 'repeat') {
    const work = step.reps.reduce((sum, r) => sum + r.parts.reduce((s, p) => s + amountDistance(p, p.zone, zones), 0), 0);
    return work + Math.max(0, step.reps.length - 1) * recoveryDistance(step.recovery, zones);
  }
  if (step.kind === 'strides') return step.count * (step.duration_s * 5.5 + step.duration_s * WALK_SPEED);
  return amountDistance(step, step.zone, zones);
}

export const sessionDistance = (steps, zones) => steps.reduce((sum, s) => sum + stepDistance(s, zones), 0);

/** Volume class of a zone, for the caps. */
function zoneClass(zone, raceKey) {
  if (zone === 'goal') return { '5k': 'interval', '10k': 'threshold', half: 'half', marathon: 'marathon' }[raceKey] ?? 'threshold';
  return { threshold: 'threshold', '10k': 'threshold', interval: 'interval', '5k': 'interval', rep: 'rep', half: 'half', marathon: 'marathon' }[zone] ?? null;
}

/** Metres of quality work by class: { threshold, interval, rep, half, marathon }. */
export function qualityWork(steps, zones, raceKey) {
  const work = { threshold: 0, interval: 0, rep: 0, half: 0, marathon: 0 };
  const add = (zone, amount) => {
    const cls = zoneClass(zone, raceKey);
    if (cls) work[cls] += amountDistance(amount, zone, zones);
  };
  for (const step of steps) {
    if (step.kind === 'repeat') step.reps.forEach((r) => r.parts.forEach((p) => add(p.zone, p)));
    else if (step.kind === 'run') add(step.zone, step);
  }
  return work;
}

/**
 * Per-session caps (after Daniels) for a week of `weekly_m`. Floors keep a
 * real session possible on low mileage: 20 min of threshold, 3 x 800 m of
 * intervals, 8 x 200 m of repetitions.
 */
export function volumeCaps(weekly_m, zones) {
  return {
    threshold: Math.max(weekly_m * 0.10, (20 * 60 / zones.threshold.slow) * 1000),
    interval: Math.max(Math.min(10000, weekly_m * 0.08), 2400),
    rep: Math.max(Math.min(8000, weekly_m * 0.05), 1600),
    half: weekly_m * 0.25,
    marathon: Math.min(weekly_m * 0.20, 29000),
  };
}

export function withinCaps(steps, zones, raceKey, weekly_m) {
  const work = qualityWork(steps, zones, raceKey);
  const caps = volumeCaps(weekly_m, zones);
  // A small tolerance so round rep counts aren't rejected over a few metres
  return Object.keys(work).every((cls) => work[cls] <= caps[cls] * 1.05 + 1);
}

/** Drop reps from the largest repeat step (keeping at least 2) until it fits; null if it can't. */
function trimToCaps(steps, zones, raceKey, weekly_m) {
  let current = steps;
  for (let guard = 0; guard < 20; guard++) {
    if (withinCaps(current, zones, raceKey, weekly_m)) return current;
    const index = current.findIndex((s) => s.kind === 'repeat' && s.reps.length > 2);
    if (index < 0) return null;
    current = current.map((s, i) => (i === index ? { ...s, reps: s.reps.slice(0, -1) } : s));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Choosing sessions
// ---------------------------------------------------------------------------

/** Round metres to half a mile or half a km. */
export function roundDistance(meters, unit) {
  const step = unit === 'mi' ? MILE / 2 : 500;
  return Math.max(step, Math.round(meters / step) * step);
}

function warmupSteps(session, weekly_m, unit) {
  if (!session.warmup) return { before: [], after: [] };
  const warm = unit === 'mi' ? (weekly_m >= 48000 ? 1.5 * MILE : MILE) : (weekly_m >= 30000 ? 2000 : 1500);
  const cool = unit === 'mi' ? MILE : 1500;
  const fast = session.legStress === 'high' || ['vo2', 'pyramid', 'reps', 'rolling', 'cutdown', 'sharpener', 'benchmark', 'race_specific'].includes(session.family);
  return {
    before: [{ kind: 'warmup', zone: 'easy', distance_m: warm }, ...(fast ? [{ kind: 'strides', count: 4, duration_s: 20 }] : [])],
    after: [{ kind: 'cooldown', zone: 'easy', distance_m: cool }],
  };
}

/**
 * Build a run from a template: steps (with warm-up and cool-down), distance,
 * and the level actually used after fitting the caps. null if it can't fit.
 */
export function buildRun(session, { level = 0, ctx, zones, raceKey, weekly_m, unit }) {
  const top = Math.min(level, session.levels.length - 1);
  for (let l = top; l >= 0; l--) {
    const main = session.levels[l](ctx);
    const fitted = session.slot === 'long' || session.slot === 'easy' || session.slot === 'race' || session.benchmark
      ? main
      : trimToCaps(main, zones, raceKey, weekly_m);
    if (!fitted) continue;
    if (session.slot === 'long' && !withinCaps(fitted, zones, raceKey, weekly_m)) continue;
    const { before, after } = warmupSteps(session, weekly_m, unit);
    const steps = [...before, ...fitted, ...after];
    return { level: l, steps, distance_m: Math.round(sessionDistance(steps, zones)) };
  }
  return null;
}

/** Long-run variant for a week, by phase and how many weeks into the phase. */
function longVariant({ phase, raceKey, weekInPhase, runsPerWeek, cutback }) {
  if (cutback || phase === 'taper') return raceKey === 'marathon' && phase === 'taper' && weekInPhase === 0 ? 'long_race_pace' : 'long_easy';
  // With 3 runs a week, the long run only has quality every third week
  if (runsPerWeek <= 3 && weekInPhase % 3 !== 2) return 'long_easy';
  const cycles = {
    base: ['long_easy', 'long_surges', 'long_fast_finish'],
    build: ['long_progression', 'long_easy', 'long_fast_finish', 'long_surges'],
    peak: raceKey === 'half' || raceKey === 'marathon'
      ? ['long_race_pace', 'long_fast_finish', 'long_race_pace', 'long_easy']
      : ['long_fast_finish', 'long_easy', 'long_surges'],
    maintain: ['long_easy', 'long_fast_finish', 'long_easy', 'long_progression'],
  };
  const list = cycles[phase] ?? ['long_easy'];
  return list[weekInPhase % list.length];
}

/**
 * Pick the session for a quality slot: allowed in this phase and race, not
 * used in the last 2 weeks, not the same family as the week's other quality
 * session; highest race weighting, then the family used longest ago.
 */
function pickSession({ slot, phase, raceKey, weekIndex, history, excludeFamilies, settings, relaxed = false }) {
  const raceWeight = (s) => s.races[raceKey] ?? 0;
  const candidates = SESSIONS.filter((s) => s.slot === slot
    && s.phases.includes(phase)
    && raceWeight(s) > 0
    && !s.benchmark
    && !excludeFamilies.has(s.family)
    && !(settings.hills === false && s.family === 'hills')
    && (relaxed || !(history.lastUsed.get(s.id) >= weekIndex - 2)));
  if (!candidates.length) return relaxed ? null : pickSession({ slot, phase, raceKey, weekIndex, history, excludeFamilies, settings, relaxed: true });
  const sinceFamily = (s) => Math.min(6, weekIndex - (history.familyUsed.get(s.family) ?? -10));
  return candidates
    .map((s, order) => ({ s, score: raceWeight(s) * 2 + sinceFamily(s) * 0.75 - order * 0.001 }))
    .sort((a, b) => b.score - a.score)[0].s;
}

// ---------------------------------------------------------------------------
// Run days and placement around lifting
// ---------------------------------------------------------------------------

const RUN_SLOTS = ['cardio', 'both'];

/**
 * Which weekdays (0 = Sunday) to run on: cardio/both days first, then
 * flexible, then lifting days, then rest days, choosing the set that includes
 * the long-run day and spreads runs out most. Returns { weekdays, warnings }.
 */
export function chooseRunWeekdays(days, runsPerWeek, longRunWeekday) {
  const tiers = [
    (slot) => RUN_SLOTS.includes(slot),
    (slot) => slot === 'flex',
    (slot) => slot === 'lift',
    (slot) => slot === 'rest',
  ];
  const ordered = [];
  for (const tier of tiers) for (let wd = 0; wd < 7; wd++) if (tier(days[wd]) && !ordered.includes(wd)) ordered.push(wd);

  // Take whole tiers while they fit, then choose the best days from the next tier
  const fixed = [];
  const lastTier = [];
  let count = 0;
  for (const tier of tiers) {
    const tierDays = ordered.filter((wd) => tier(days[wd]));
    if (count + tierDays.length <= runsPerWeek) {
      fixed.push(...tierDays);
      count += tierDays.length;
    } else {
      lastTier.push(...tierDays);
      break;
    }
  }
  const need = runsPerWeek - fixed.length;
  let best = null;
  for (const combo of combinations(lastTier, need)) {
    const set = [...fixed, ...combo].sort((a, b) => a - b);
    const score = (set.includes(longRunWeekday) ? 100 : 0) + spread(set);
    if (!best || score > best.score) best = { set, score };
  }
  const weekdays = best?.set ?? fixed.sort((a, b) => a - b);

  const warnings = [];
  const onLift = weekdays.filter((wd) => days[wd] === 'lift');
  const onRest = weekdays.filter((wd) => days[wd] === 'rest');
  const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (onLift.length) warnings.push(`Not enough cardio days in your schedule, so some runs are on lifting days (${onLift.map((wd) => NAMES[wd]).join(', ')}).`);
  if (onRest.length) warnings.push(`Some runs are on rest days (${onRest.map((wd) => NAMES[wd]).join(', ')}). Consider adding cardio days to your schedule.`);
  if (!weekdays.includes(longRunWeekday)) warnings.push(`${NAMES[longRunWeekday]} isn't one of your run days, so the long run goes on another day.`);
  return { weekdays, warnings };
}

function* combinations(list, k, start = 0, prefix = []) {
  if (k === 0) {
    yield prefix;
    return;
  }
  for (let i = start; i <= list.length - k; i++) yield* combinations(list, k - 1, i + 1, [...prefix, list[i]]);
}

/** Smallest gap between run days around the week, plus a little for evenness. */
function spread(weekdays) {
  if (weekdays.length < 2) return 0;
  const gaps = weekdays.map((wd, i) => ((weekdays[(i + 1) % weekdays.length] - wd + 7) % 7) || 7);
  return Math.min(...gaps) * 10 - (Math.max(...gaps) - Math.min(...gaps));
}

const addDays = (date, n) => formatDay(parseDay(date) + n * DAY_MS);

/**
 * Put a week's runs on its run dates, keeping hard running away from heavy
 * leg days. runs: [{ role: 'A'|'B'|'long'|'easy', hard, quality, legStress }]; `quality` marks a long run with faster running.
 * Returns { dates: [date per run], penalty, problems: [string] }.
 */
export function placeRuns(runs, dates, { heavyLegDates = new Set(), liftDates = new Set(), longDate = null }) {
  const isHeavy = (date) => heavyLegDates.has(date);
  const score = (assignment) => {
    let penalty = 0;
    const problems = [];
    assignment.forEach((date, i) => {
      const r = runs[i];
      const next = addDays(date, 1);
      const prev = addDays(date, -1);
      if (r.role === 'long' && longDate && date !== longDate) penalty += 5;
      if (r.hard) {
        if (isHeavy(next)) {
          penalty += r.legStress === 'high' ? 10 : 6;
          problems.push({ run: i, date, kind: 'before_heavy' });
        }
        if (isHeavy(prev)) penalty += r.legStress === 'high' ? 3 : 1;
        if (liftDates.has(date)) penalty += isHeavy(date) ? 4 : 1;
      } else if (r.role === 'long') {
        if (isHeavy(next)) {
          penalty += r.quality ? 6 : 4;
          problems.push({ run: i, date, kind: 'long_before_heavy' });
        }
        if (isHeavy(prev)) penalty += 2;
      }
      assignment.forEach((other, j) => {
        if (j <= i) return;
        const gap = Math.abs(parseDay(other) - parseDay(date)) / DAY_MS;
        const bothHard = (r.hard || r.role === 'long') && (runs[j].hard || runs[j].role === 'long');
        if (gap === 1 && r.hard && runs[j].hard) penalty += 8;
        else if (gap === 1 && bothHard) penalty += 3;
      });
    });
    return { penalty, problems };
  };

  let best = null;
  for (const perm of permutations(dates.slice(0, runs.length))) {
    const result = score(perm);
    if (!best || result.penalty < best.penalty) best = { dates: perm, ...result };
  }
  return best ?? { dates: [], penalty: 0, problems: [] };
}

function* permutations(list) {
  if (list.length <= 1) {
    yield list;
    return;
  }
  for (let i = 0; i < list.length; i++) {
    for (const rest of permutations([...list.slice(0, i), ...list.slice(i + 1)])) yield [list[i], ...rest];
  }
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generate a plan.
 *
 * input: {
 *   kind: 'race' | 'maintain',
 *   race: { key: '5k'|'10k'|'half'|'marathon', date, goal_s? }   (race plans)
 *   weeks: number                                                   (maintenance; default 12)
 *   vdot, baseline: { weekly_m, longest_m },
 *   runsPerWeek (3–6), longRunWeekday (0–6),
 *   days: 7 schedule slots (Sunday first),
 *   heavyLegDates: Set, liftDates: Set, deloadWeekStarts: Set,
 *   startDate, unit: 'mi'|'km', settings: { hills: true }
 * }
 * Returns { ok: true, plan } or { ok: false, error }.
 * plan: { kind, start_date, end_date, race, vdot, zones, weekdays, warnings,
 *         weeks: [{ index, week_start, phase, cutback, target_m, total_m, runs: [...] }] }
 */
export function generatePlan(input) {
  const {
    kind, race = null, vdot, baseline = {}, runsPerWeek, longRunWeekday, days,
    heavyLegDates = new Set(), liftDates = new Set(), deloadWeekStarts = new Set(),
    startDate, unit = 'km', settings = {},
  } = input;

  if (!(vdot > 20 && vdot < 90)) return { ok: false, error: 'A current fitness level (VDOT) between 20 and 90 is needed.' };
  if (!(runsPerWeek >= 3 && runsPerWeek <= 6)) return { ok: false, error: 'Runs per week must be between 3 and 6.' };
  const raceKey = kind === 'race' ? race?.key : 'maintain';
  if (kind === 'race' && !RACE_DISTANCES[raceKey]) return { ok: false, error: 'Unknown race distance.' };

  const goalPace = kind === 'race' && race.goal_s > 0 ? race.goal_s / (RACE_DISTANCES[raceKey].meters / 1000) : null;
  const zones = paceZones(vdot, { goalPace });
  const warnings = [];

  // Weeks
  const thisWeek = weekStartOf(parseDay(startDate));
  let firstWeek = thisWeek;
  let phases;
  if (kind === 'race') {
    if (race.date <= startDate) return { ok: false, error: 'The race date must be after today.' };
    // The race week is the week leading into the race: a Sunday race closes the week before
    const raceWeek = weekStartOf(parseDay(race.date) - DAY_MS);
    let count = (raceWeek - thisWeek) / (7 * DAY_MS) + 1;
    const shape = PLAN_SHAPES[raceKey];
    if (count < shape.minWeeks) {
      return { ok: false, error: `A ${RACE_DISTANCES[raceKey].label} plan needs at least ${shape.minWeeks} weeks; this race is ${count} week${count === 1 ? '' : 's'} away.` };
    }
    const maxWeeks = shape.base + shape.build + shape.peak + shape.taper + EXTRA_BASE_WEEKS;
    if (count > maxWeeks) {
      firstWeek = raceWeek - (maxWeeks - 1) * 7 * DAY_MS;
      warnings.push(`The race is a long way off, so the plan starts on ${formatDay(firstWeek)}. Until then, a maintenance plan keeps you ticking over.`);
      count = maxWeeks;
    }
    const defaultLength = shape.base + shape.build + shape.peak + shape.taper;
    if (count < defaultLength) warnings.push(`${count} weeks is shorter than the usual ${defaultLength} for a ${RACE_DISTANCES[raceKey].label}, so the base phase is shortened.`);
    phases = phasesFor(raceKey, count);
  } else {
    phases = Array(input.weeks ?? 12).fill('maintain');
  }
  const weekStarts = phases.map((_, i) => formatDay(firstWeek + i * 7 * DAY_MS));
  const cutbacks = cutbackWeeks(phases, weekStarts, deloadWeekStarts);
  const targets = weeklyTargets({ raceKey, phases, cutbacks, startWeekly: baseline.weekly_m, runsPerWeek });
  const longTargets = longRunTargets({ raceKey, phases, cutbacks, targets, baseline, runsPerWeek });

  // Run days
  const { weekdays, warnings: dayWarnings } = chooseRunWeekdays(days, runsPerWeek, longRunWeekday);
  warnings.push(...dayWarnings);
  const longWeekday = weekdays.includes(longRunWeekday) ? longRunWeekday : weekdays[weekdays.length - 1];

  const history = { lastUsed: new Map(), familyUsed: new Map(), levels: new Map() };
  const ctxBase = { mile: unit === 'mi' ? MILE : 1600, race: raceKey, hasGoal: !!goalPace, race_m: RACE_DISTANCES[raceKey]?.meters };
  let cutbackCount = 0;
  const placementNotes = new Set();
  const phaseWeek = new Map();

  const weeks = phases.map((phase, index) => {
    const weekStart = weekStarts[index];
    const cutback = cutbacks.has(index);
    const target = targets[index];
    const weekInPhase = phaseWeek.get(phase) ?? 0;
    phaseWeek.set(phase, weekInPhase + 1);
    const isRaceWeek = kind === 'race' && index === phases.length - 1;

    // Dates this week the athlete can run (from the start date on)
    let runDates = weekdays.map((wd) => addDays(weekStart, wd)).filter((date) => date >= startDate);
    if (isRaceWeek) runDates = runDates.filter((date) => date < race.date);
    const longDate = runDates.find((date) => new Date(parseDay(date)).getUTCDay() === longWeekday) ?? null;

    if (isRaceWeek) return raceWeek({ index, weekStart, target, runDates, race, raceKey, runsPerWeek, heavyLegDates, ctxBase, zones, unit, history });

    // Roles this week. A first week that starts after the long-run day has no long run.
    let roles = rolesFor(runsPerWeek, index, phase);
    if (!longDate && index === 0) roles = roles.map((r) => (r === 'long' ? 'easy' : r));
    const count = Math.min(runDates.length, roles.length);
    const weekRoles = trimRoles(roles, count);
    // Quality sessions in the taper are kept small
    const qualityWeekly = phase === 'taper' ? target * 0.7 : target;

    // Long run
    const runs = [];
    if (weekRoles.includes('long')) {
      const longDistance = roundDistance(Math.max(longTargets[index], 5000), unit);
      const variantId = longVariant({ phase, raceKey, weekInPhase, runsPerWeek, cutback });
      const variant = sessionById(variantId);
      const level = history.levels.get(variantId) ?? 0;
      const built = buildRun(variant, { level, ctx: { ...ctxBase, distance_m: longDistance }, zones, raceKey, weekly_m: target, unit })
        ?? buildRun(sessionById('long_easy'), { ctx: { ...ctxBase, distance_m: longDistance }, zones, raceKey, weekly_m: target, unit });
      // If the variant didn't fit and fell back to an easy long run, call it that
      const zonesIn = (step) => (step.kind === 'repeat' ? step.reps.flatMap((r) => r.parts.map((p) => p.zone)) : [step.zone]);
      const hasFaster = built.steps.some((step) => zonesIn(step).some((z) => z && z !== 'easy'));
      const used = hasFaster ? variant : sessionById('long_easy');
      runs.push(runEntry(used, built, 'long'));
      bump(history, used, index);
    }

    // Quality sessions
    const excludeFamilies = new Set();
    for (const role of weekRoles.filter((r) => r === 'A' || r === 'B')) {
      let session = null;
      if (cutback) {
        session = role === 'B'
          ? (cutbackCount % 2 === 0 ? sessionById('time_trial') : sessionById('progression'))
          : (excludeFamilies.has('fartlek') ? sessionById('reps') : sessionById('fartlek'));
        if (settingsBlocks(session, settings)) session = sessionById('fartlek');
      } else {
        session = pickSession({ slot: role, phase, raceKey, weekIndex: index, history, excludeFamilies, settings })
          ?? pickSession({ slot: role === 'A' ? 'B' : 'A', phase, raceKey, weekIndex: index, history, excludeFamilies, settings });
      }
      if (!session) continue;
      const level = cutback ? 0 : (phase === 'taper' ? Math.max(0, (history.levels.get(session.id) ?? 0) - 2) : history.levels.get(session.id) ?? 0);
      const built = buildRun(session, { level, ctx: ctxBase, zones, raceKey, weekly_m: qualityWeekly, unit });
      if (!built) continue;
      runs.push(runEntry(session, built, role));
      excludeFamilies.add(session.family);
      bump(history, session, index, built.level);
    }
    if (cutback && weekRoles.includes('B')) cutbackCount += 1;

    // Easy runs share what's left of the week's distance
    const easyCount = count - runs.length;
    if (easyCount > 0) {
      const used = runs.reduce((sum, r) => sum + r.distance_m, 0);
      const longest = runs.find((r) => r.role === 'long')?.distance_m ?? target * 0.3;
      // Easy runs fill the week, within reason: never longer than 85% of the long run
      const each = Math.min(Math.max((target - used) / easyCount, 4000), Math.max(longest * 0.7, (target / runsPerWeek) * 1.1), longest * 0.85);
      for (let i = 0; i < easyCount; i++) {
        // One easy run a week gets strides (two in base with 5+ runs); the 6th run is a recovery run
        const id = i === 0 || (phase === 'base' && i === 1 && runsPerWeek >= 5) ? 'easy_strides' : (runsPerWeek >= 6 && i === easyCount - 1 ? 'recovery' : 'easy');
        const distance = roundDistance(id === 'recovery' ? Math.min(each, 6000) : each, unit);
        const session = sessionById(id);
        const built = buildRun(session, { ctx: { ...ctxBase, distance_m: distance }, zones, raceKey, weekly_m: target, unit });
        runs.push(runEntry(session, built, 'easy'));
      }
    }

    // Dates
    const placement = placeRuns(
      runs.map((r) => ({ role: r.role, hard: r.role === 'A' || r.role === 'B', quality: r.key, legStress: r.leg_stress })),
      runDates,
      { heavyLegDates, liftDates, longDate },
    );
    runs.forEach((r, i) => { r.date = placement.dates[i]; });
    for (const problem of placement.problems) {
      const day = WEEKDAY_NAMES[new Date(parseDay(problem.date)).getUTCDay()];
      const nextDay = WEEKDAY_NAMES[(new Date(parseDay(problem.date)).getUTCDay() + 1) % 7];
      placementNotes.add(problem.kind === 'long_before_heavy'
        ? `Some long runs fall on ${day}, the day before heavy legs on ${nextDay}. If you can, move that leg day.`
        : `With your current days, some hard runs land on ${day}, the day before heavy legs on ${nextDay}. The gentler of the week's hard sessions goes there where possible, but moving your squat or deadlift day would help.`);
    }
    runs.sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      index, week_start: weekStart, phase, cutback, target_m: target,
      total_m: runs.reduce((sum, r) => sum + r.distance_m, 0), runs,
    };
  });

  warnings.push(...placementNotes);
  const lastWeek = weeks[weeks.length - 1];
  return {
    ok: true,
    plan: {
      kind,
      race: kind === 'race' ? { ...race, label: RACE_DISTANCES[raceKey].label, meters: RACE_DISTANCES[raceKey].meters } : null,
      vdot,
      zones,
      unit,
      weekdays,
      long_run_weekday: longWeekday,
      start_date: weeks[0].week_start < startDate ? startDate : weeks[0].week_start,
      end_date: kind === 'race' ? race.date : addDays(lastWeek.week_start, 6),
      warnings,
      weeks,
    },
  };
}

function settingsBlocks(session, settings) {
  return settings.hills === false && session.family === 'hills';
}

/** Session roles for a week: long run, quality sessions, easy runs. */
function rolesFor(runsPerWeek, index, phase) {
  // With 3 runs, one quality session a week, alternating speed and threshold
  const quality = runsPerWeek <= 3 ? [index % 2 === 0 ? 'B' : 'A'] : ['A', 'B'];
  // Maintenance: one quality session, rotating threshold -> speed -> hills/reps -> (cutback) benchmark or progression
  if (phase === 'maintain') return ['long', index % 4 === 0 || index % 4 === 3 ? 'B' : 'A', ...Array(runsPerWeek - 2).fill('easy')];
  return ['long', ...quality, ...Array(runsPerWeek - 1 - quality.length).fill('easy')];
}

/** Fewer run days than roles (a part week): keep the long run and quality first. */
function trimRoles(roles, count) {
  return roles.slice(0, count);
}

function bump(history, session, index, level = null) {
  history.lastUsed.set(session.id, index);
  history.familyUsed.set(session.family, index);
  if (session.levels.length > 1) history.levels.set(session.id, Math.min((level ?? history.levels.get(session.id) ?? 0) + 1, session.levels.length - 1));
}

function runEntry(session, built, role) {
  const hard = role === 'A' || role === 'B' || session.quality === true || role === 'race';
  return {
    date: null,
    session_id: session.id,
    family: session.family,
    role,
    level: built.level,
    title: session.name,
    purpose: session.purpose,
    cue: session.cue,
    key: hard,
    leg_stress: session.legStress,
    steps: built.steps,
    distance_m: built.distance_m,
  };
}

/**
 * Race week: a few short easy runs, a sharpener 3–4 days out, a shakeout the
 * day before (optional if that isn't a run day), then the race. Fewer runs
 * than a normal week.
 */
function raceWeek({ index, weekStart, target, runDates, race, raceKey, runsPerWeek, heavyLegDates, ctxBase, zones, unit, history }) {
  const runs = [];
  const add = (session, date, role, extra = {}, distance = null) => {
    const built = buildRun(session, { ctx: { ...ctxBase, distance_m: distance }, zones, raceKey, weekly_m: target, unit });
    runs.push({ ...runEntry(session, built, role), date, ...extra });
    bump(history, session, index);
  };

  const dayBefore = addDays(race.date, -1);
  const before = [...runDates].sort().slice(-(runsPerWeek - 1));
  const sharpenerDate = before.filter((date) => date !== dayBefore && date <= addDays(race.date, -3)).pop()
    ?? before.filter((date) => date !== dayBefore).pop() ?? null;
  const easyDates = before.filter((date) => date !== sharpenerDate && date !== dayBefore);
  const easyDistance = roundDistance(Math.min(Math.max(target / Math.max(before.length, 1), 3000), 8000), unit);

  for (const date of easyDates) add(sessionById('easy'), date, 'easy', {}, easyDistance);
  if (sharpenerDate) add(sessionById('sharpener'), sharpenerDate, 'A');
  if (before.includes(dayBefore) || !heavyLegDates.has(dayBefore)) {
    add(sessionById('shakeout'), dayBefore, 'easy', before.includes(dayBefore) ? {} : { optional: true, title: 'Shakeout (optional)' });
  }
  const raceSession = sessionById('race');
  add(raceSession, race.date, 'race', { title: race.name || `${RACE_DISTANCES[raceKey].label} race` });

  runs.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    index, week_start: weekStart, phase: 'race', cutback: false, target_m: target,
    total_m: runs.reduce((sum, r) => sum + r.distance_m, 0), runs,
  };
}

/** What a plan needs from the athlete's history: current weekly distance and longest run. */
export function runningBaseline(sessions, today) {
  const since28 = addDays(today, -28);
  const since42 = addDays(today, -42);
  const runs = sessions.filter((s) => s.kind === 'cardio' && s.sport === 'run' && s.distance_m > 0 && s.date <= today);
  const recent = runs.filter((s) => s.date > since28);
  return {
    weekly_m: Math.round(recent.reduce((sum, s) => sum + s.distance_m, 0) / 4),
    longest_m: Math.round(Math.max(0, ...runs.filter((s) => s.date > since42).map((s) => s.distance_m))),
    runs_28d: recent.length,
  };
}
