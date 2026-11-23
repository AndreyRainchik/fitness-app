/**
 * The week view: what each day of a week is planned for, and what was done.
 *
 * Pure functions (no database) so they can be tested directly. Dates are
 * 'YYYY-MM-DD', handled in UTC; weeks run Sunday–Saturday like the rest of
 * the app.
 *
 * How program lifts land on days
 * ------------------------------
 * The weekly schedule says which weekdays are for lifting. The active
 * program's lifts are a queue: the lifts of the current program week that
 * aren't done yet, in the user's lift order, then the next program week's, and
 * so on. Upcoming lifting days take from the front of the queue, so a missed
 * day pushes its lifts to the next lifting day rather than dropping them, the
 * way 5/3/1 and Starting Strength are run.
 *
 * A lift of the current program week is done when it has a status (completed,
 * failed or skipped) or a strength workout since the week began contains it.
 * The week begins on the program's week_started_on (set when the user
 * completes a week), or, before that's been recorded, on this calendar week's
 * Sunday. Workouts on the start day itself don't count, since that's normally
 * the day the previous week was finished.
 */

import Program from '../models/Program.js';
import { DAY_MS, formatDay, parseDay, weekStartOf } from './cardioStats.js';

export const SLOTS = ['lift', 'cardio', 'both', 'rest', 'flex'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DEFAULT_DAYS = ['flex', 'flex', 'flex', 'flex', 'flex', 'flex', 'flex'];

export const liftsOn = (slot) => slot === 'lift' || slot === 'both';
export const cardioOn = (slot) => slot === 'cardio' || slot === 'both';

const SCHEME_531 = { 1: '5s', 2: '3s', 3: '5/3/1', 4: 'Deload' };
// Starting Strength: cycle 1 is workout A, cycle 2 workout B
const SS_SESSIONS = {
  1: { title: 'Workout A', lifts: ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift'] },
  2: { title: 'Workout B', lifts: ['Barbell Squat', 'Barbell Overhead Press', 'Barbell Deadlift'] },
};

/** A valid 7-slot schedule, or null. */
export function normalizeDays(days) {
  if (!Array.isArray(days) || days.length !== 7) return null;
  return days.every((slot) => SLOTS.includes(slot)) ? [...days] : null;
}

/** The slot for a date: its override, else its weekday's. */
export function slotFor(date, days, overrides = new Map()) {
  return overrides.get(date) ?? days[new Date(parseDay(date)).getUTCDay()];
}

/** The Sunday of the week containing `date`. */
export const weekStartFor = (date) => formatDay(weekStartOf(parseDay(date)));

/** The program's lifts in the user's lift order; lifts not in it keep program order, after. */
export function orderedLifts(lifts, liftOrder = []) {
  const rank = new Map(liftOrder.map((id, i) => [Number(id), i]));
  return lifts
    .map((lift, i) => ({ lift, rank: rank.get(Number(lift.exercise_id)) ?? liftOrder.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ lift }) => lift);
}

/** How many 5/3/1 lifts go on one lifting day: 4 lifts over 4 days is 1, over 2 days is 2. */
export function liftsPerDay(liftCount, liftDays) {
  if (!liftDays) return 1;
  return Math.max(1, Math.round(liftCount / liftDays));
}

const nextWeek531 = ({ week, cycle }) => (week >= 4 ? { week: 1, cycle: cycle + 1 } : { week: week + 1, cycle });

function liftUnit531(program, lift, week, cycle) {
  // Training maxes change at the end of a cycle, so weights are only known within this one
  const sets = cycle === program.current_cycle ? Program.calculate531Week(week, lift.training_max) : null;
  const top = sets?.[sets.length - 1];
  return {
    key: `531:${cycle}:${week}:${lift.exercise_id}`,
    exercise_id: lift.exercise_id,
    name: lift.exercise_name,
    detail: `Week ${week} · ${SCHEME_531[week] ?? ''}`.trim(),
    top_set: top ? { weight: top.weight, reps: top.reps, amrap: !!top.is_amrap } : null,
  };
}

function ssSession(program, number, cycle) {
  const session = SS_SESSIONS[cycle] ?? SS_SESSIONS[1];
  const byName = new Map(program.lifts.map((lift) => [lift.exercise_name, lift]));
  const isCurrent = number === program.current_week;
  return {
    key: `ss:${number}`,
    title: session.title,
    detail: `Session ${number}`,
    lifts: session.lifts
      .map((name) => byName.get(name))
      .filter(Boolean)
      .map((lift) => ({
        key: `ss:${number}:${lift.exercise_id}`,
        exercise_id: lift.exercise_id,
        name: lift.exercise_name,
        detail: session.title,
        // Weights move every session, so only the next session's are certain
        top_set: isCurrent ? { weight: lift.training_max, reps: 5, amrap: false } : null,
      })),
  };
}

/**
 * Which of the current program week's lifts are done, and where.
 * Returns { done: [{ unit, workout_id, date, status }], pendingIds: Set }.
 * `status` is the lift's status, or null when a workout contains the lift but
 * it hasn't been marked.
 */
export function programProgress(program, sessions, { today, liftOrder = [] }) {
  const since = program.week_started_on || weekStartFor(today);
  const inWindow = sessions.filter((s) => s.kind !== 'cardio' && s.date <= today
    && (program.week_started_on ? s.date > since : s.date >= since));
  const workoutWith = (exerciseIds) => inWindow.find((s) => exerciseIds.every((id) => s.exercise_ids.includes(Number(id))));
  const statuses = program.statuses ?? new Map();
  const done = [];

  if (program.type === '531') {
    const pendingIds = new Set();
    for (const lift of orderedLifts(program.lifts, liftOrder)) {
      const status = statuses.get(Number(lift.exercise_id)) ?? null;
      const workout = workoutWith([lift.exercise_id]);
      if (status || workout) {
        done.push({
          unit: liftUnit531(program, lift, program.current_week, program.current_cycle),
          workout_id: workout?.id ?? null,
          date: workout?.date ?? null,
          status,
        });
      } else {
        pendingIds.add(Number(lift.exercise_id));
      }
    }
    return { done, pendingIds };
  }

  if (program.type === 'starting_strength') {
    const session = ssSession(program, program.current_week, program.current_cycle);
    const ids = session.lifts.map((l) => l.exercise_id);
    const allMarked = ids.length > 0 && ids.every((id) => statuses.has(Number(id)));
    // The squat is in both sessions, so a workout has to contain at least two of this one's lifts
    const workout = inWindow.find((s) => ids.filter((id) => s.exercise_ids.includes(Number(id))).length >= Math.min(2, ids.length));
    if (allMarked || workout) {
      done.push({ unit: session, workout_id: workout?.id ?? null, date: workout?.date ?? null, status: allMarked ? 'completed' : null });
      return { done, pendingIds: new Set() };
    }
    return { done, pendingIds: new Set(ids.map(Number)) };
  }

  return { done, pendingIds: new Set() };
}

/**
 * The upcoming lifting sessions, in order: an iterator of { title, detail,
 * lifts: [unit] }. Starts with what's left of the current program week.
 */
export function* programQueue(program, { pendingIds, perDay, liftOrder = [] }) {
  if (program.type === '531') {
    const lifts = orderedLifts(program.lifts, liftOrder);
    if (!lifts.length) return;
    let position = { week: program.current_week, cycle: program.current_cycle };
    let first = true;
    for (let guard = 0; guard < 520; guard++) {
      const weekLifts = first ? lifts.filter((l) => pendingIds.has(Number(l.exercise_id))) : lifts;
      first = false;
      // Group within a program week, so a day never mixes two weeks' lifts
      for (let i = 0; i < weekLifts.length; i += perDay) {
        const units = weekLifts.slice(i, i + perDay).map((l) => liftUnit531(program, l, position.week, position.cycle));
        yield {
          title: units.map((u) => shortLiftName(u.name)).join(' + '),
          detail: `Week ${position.week} · ${SCHEME_531[position.week]}${position.cycle !== program.current_cycle ? ` · cycle ${position.cycle}` : ''}`,
          lifts: units,
        };
      }
      position = nextWeek531(position);
    }
    return;
  }

  if (program.type === 'starting_strength') {
    let number = program.current_week;
    let cycle = program.current_cycle;
    if (!pendingIds.size) {
      number += 1;
      cycle = cycle === 1 ? 2 : 1;
    }
    for (let guard = 0; guard < 520; guard++) {
      const session = ssSession(program, number, cycle);
      yield { title: session.title, detail: session.detail, lifts: session.lifts };
      number += 1;
      cycle = cycle === 1 ? 2 : 1;
    }
  }
}

/** "Barbell Overhead Press" -> "Overhead Press" */
export const shortLiftName = (name) => String(name).replace(/^Barbell /, '');

function sessionSummary(s, programUnits) {
  return {
    id: s.id,
    date: s.date,
    kind: s.kind === 'cardio' ? 'cardio' : 'strength',
    name: s.name ?? null,
    sport: s.sport ?? null,
    environment: s.environment ?? null,
    duration_s: s.kind === 'cardio' ? (s.duration_s ?? null) : (s.duration_minutes > 0 ? s.duration_minutes * 60 : null),
    distance_m: s.distance_m ?? null,
    avg_hr: s.avg_hr ?? null,
    exercises: s.exercise_names ?? [],
    program: programUnits.get(s.id) ?? [],
  };
}

/**
 * Build one week.
 *
 * input: {
 *   weekStart, today,
 *   days: 7 slots or null (no schedule yet),
 *   overrides: Map date -> slot,
 *   program: null | { id, name, type, current_week, current_cycle, week_started_on,
 *                     lifts: [{ exercise_id, exercise_name, training_max }], statuses: Map exercise_id -> status },
 *   liftOrder: [exercise_id],
 *   sessions: [{ id, date, kind, name, sport, environment, duration_s, duration_minutes,
 *                distance_m, avg_hr, exercise_ids: [number], exercise_names: [string] }]
 *     every session from the program week's start (or this week's Sunday) to the end of the shown week
 * }
 *
 * Returns { week_start, week_end, configured, days: [...], summary, program }
 */
export function buildWeek({ weekStart, today, days, overrides = new Map(), program = null, liftOrder = [], sessions = [], plannedRuns = [] }) {
  const start = parseDay(weekStartFor(weekStart));
  const dates = Array.from({ length: 7 }, (_, i) => formatDay(start + i * DAY_MS));
  const weekEnd = dates[6];
  const configured = !!days;
  const schedule = days ?? DEFAULT_DAYS;

  const sessionsByDay = new Map();
  for (const s of sessions) {
    if (!sessionsByDay.has(s.date)) sessionsByDay.set(s.date, []);
    sessionsByDay.get(s.date).push(s);
  }
  const strengthOn = (date) => (sessionsByDay.get(date) ?? []).filter((s) => s.kind !== 'cardio');
  const cardioOnDay = (date) => (sessionsByDay.get(date) ?? []).filter((s) => s.kind === 'cardio');

  // Program progress, and which workouts its lifts were done in
  const hasProgram = program && program.lifts?.length;
  const progress = hasProgram ? programProgress(program, sessions, { today, liftOrder }) : null;
  const programUnits = new Map();
  for (const entry of progress?.done ?? []) {
    if (!entry.workout_id) continue;
    const units = entry.unit.lifts ?? [entry.unit];
    programUnits.set(entry.workout_id, [...(programUnits.get(entry.workout_id) ?? []), ...units.map((u) => ({ ...u, status: entry.status }))]);
  }

  // Hand out queued sessions to lifting days from today on, up to the end of this week
  const assigned = new Map();
  if (configured && hasProgram && weekEnd >= today) {
    const liftDays = schedule.filter(liftsOn).length;
    const perDay = program.type === '531' ? liftsPerDay(program.lifts.length, liftDays) : 1;
    const queue = programQueue(program, { pendingIds: progress.pendingIds, perDay, liftOrder });
    for (let day = parseDay(today); day <= parseDay(weekEnd); day += DAY_MS) {
      const date = formatDay(day);
      if (!liftsOn(slotFor(date, schedule, overrides))) continue;
      if (date === today && strengthOn(date).length) continue;
      const next = queue.next();
      if (next.done) break;
      if (date >= dates[0]) assigned.set(date, next.value);
    }
  }

  const statusFor = (date, done) => {
    if (done) return 'done';
    if (date < today) return 'missed';
    return date === today ? 'today' : 'upcoming';
  };

  const dayRows = dates.map((date, i) => {
    const slot = configured ? slotFor(date, schedule, overrides) : 'flex';
    const planned = [];
    if (liftsOn(slot)) {
      const done = strengthOn(date);
      const queued = done.length ? null : assigned.get(date);
      planned.push({
        kind: 'strength',
        status: statusFor(date, done.length > 0),
        title: queued?.title ?? (hasProgram && done.length ? programTitle(done, programUnits) : null) ?? 'Lift',
        detail: queued?.detail ?? null,
        lifts: queued?.lifts ?? [],
        workout_ids: done.map((s) => s.id),
      });
    }
    // Runs from a run plan, on whatever day they're planned; done when a run is logged that day
    const runsToday = plannedRuns.filter((r) => r.date === date);
    const runsDone = cardioOnDay(date).filter((s) => s.sport === 'run');
    runsToday.forEach((r, i) => {
      const done = runsDone.length > i ? [runsDone[i]] : [];
      planned.push({
        kind: 'run',
        status: r.status === 'skipped' ? 'skipped' : (done.length ? 'done' : (r.optional && date < today ? 'skipped' : statusFor(date, false))),
        title: r.title,
        detail: null,
        lifts: [],
        workout_ids: done.map((s) => s.id),
        run: r,
      });
    });
    if (cardioOn(slot) && !runsToday.length) {
      const done = cardioOnDay(date);
      planned.push({
        kind: 'cardio',
        status: statusFor(date, done.length > 0),
        title: 'Cardio',
        detail: null,
        lifts: [],
        workout_ids: done.map((s) => s.id),
      });
    }
    return {
      date,
      weekday: WEEKDAYS[i],
      slot,
      usual_slot: configured ? schedule[i] : 'flex',
      overridden: configured && overrides.has(date) && overrides.get(date) !== schedule[i],
      is_today: date === today,
      planned,
      sessions: (sessionsByDay.get(date) ?? []).map((s) => sessionSummary(s, programUnits)),
    };
  });

  return {
    week_start: dates[0],
    week_end: weekEnd,
    today,
    configured,
    days: dayRows,
    summary: summarize(dayRows),
    program: hasProgram ? programInfo(program, progress) : null,
  };
}

function programTitle(done, programUnits) {
  const units = done.flatMap((s) => programUnits.get(s.id) ?? []);
  return units.length ? units.map((u) => shortLiftName(u.name)).join(' + ') : null;
}

function programInfo(program, progress) {
  const position = program.type === '531'
    ? `Week ${program.current_week} · Cycle ${program.current_cycle}`
    : `Session ${program.current_week} · ${(SS_SESSIONS[program.current_cycle] ?? SS_SESSIONS[1]).title}`;
  return {
    id: program.id,
    name: program.name,
    type: program.type,
    position,
    // Every lift of the program week is done: time to complete the week in This Week
    ready_to_advance: progress.pendingIds.size === 0,
    unmarked: progress.done.filter((d) => !d.status).length,
  };
}

/** Planned vs done for the week. */
export function summarize(dayRows) {
  const sessions = dayRows.flatMap((d) => d.sessions);
  const planned = dayRows.flatMap((d) => d.planned);
  // Planned runs count as cardio; optional runs (a race-week shakeout) don't count towards the plan
  const kindOf = (p) => (p.kind === 'run' ? 'cardio' : p.kind);
  const counted = planned.filter((p) => !p.run?.optional);
  const count = (kind) => counted.filter((p) => kindOf(p) === kind).length;
  const doneDays = (kind) => counted.filter((p) => kindOf(p) === kind && p.status === 'done').length;
  const total = (list, field) => list.reduce((sum, s) => sum + (s[field] || 0), 0);
  const strength = sessions.filter((s) => s.kind === 'strength');
  const cardio = sessions.filter((s) => s.kind === 'cardio');
  return {
    strength: { planned: count('strength'), done: doneDays('strength'), sessions: strength.length, duration_s: total(strength, 'duration_s') },
    cardio: {
      planned: count('cardio'),
      done: doneDays('cardio'),
      sessions: cardio.length,
      duration_s: total(cardio, 'duration_s'),
      distance_m: total(cardio, 'distance_m'),
      run_distance_m: total(cardio.filter((s) => s.sport === 'run'), 'distance_m'),
      // Distance of the week's planned runs, when there's a run plan
      planned_run_m: counted.filter((p) => p.kind === 'run').reduce((sum, p) => sum + (p.run.distance_m || 0), 0),
    },
    missed: planned.filter((p) => p.status === 'missed').length,
  };
}

const HEAVY_LEGS = /squat|deadlift/i;

/**
 * Lifting days from `from` to `until`, with what's expected on each: the
 * schedule's lifting days filled from the program's lift queue, as the week
 * view does. For the run planner, so hard runs stay away from heavy legs.
 *
 * Returns { days: [{ date, lifts: [name], heavy_legs, program_week }], deloadWeekStarts: Set }.
 * Without a program every lifting day counts as heavy legs (we can't know).
 */
export function projectLiftDays({ from, until, days, overrides = new Map(), program = null, liftOrder = [], sessions = [], today }) {
  const schedule = days ?? DEFAULT_DAYS;
  const hasProgram = program && program.lifts?.length;
  const result = [];
  const deloadWeekStarts = new Set();
  let queue = null;
  if (hasProgram) {
    const progress = programProgress(program, sessions, { today, liftOrder });
    const liftDays = schedule.filter(liftsOn).length;
    const perDay = program.type === '531' ? liftsPerDay(program.lifts.length, liftDays) : 1;
    queue = programQueue(program, { pendingIds: progress.pendingIds, perDay, liftOrder });
  }
  for (let ms = parseDay(from); ms <= parseDay(until); ms += DAY_MS) {
    const date = formatDay(ms);
    if (!liftsOn(slotFor(date, schedule, overrides))) continue;
    if (!queue) {
      result.push({ date, lifts: [], heavy_legs: true, program_week: null });
      continue;
    }
    const next = queue.next();
    if (next.done) break;
    const lifts = next.value.lifts.map((l) => l.name);
    // 5/3/1 keys are '531:<cycle>:<week>:<exercise>'
    const week = program.type === '531' ? Number(String(next.value.lifts[0]?.key ?? '').split(':')[2]) || null : null;
    if (week === 4) deloadWeekStarts.add(weekStartFor(date));
    result.push({ date, lifts, heavy_legs: lifts.some((name) => HEAVY_LEGS.test(name)), program_week: week });
  }
  return { days: result, deloadWeekStarts };
}
