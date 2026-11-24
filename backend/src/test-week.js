#!/usr/bin/env node
/**
 * Week view tests: how program lifts and cardio land on days (pure
 * functions), then the /api/week routes end to end against a throwaway
 * database.
 *
 *   npm run test:week
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildWeek, fixedLiftsPerDay, liftsPerDay, normalizeDays, orderedLifts, projectLiftDays, slotFor, weekStartFor,
} from './services/weekPlan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name}\n    ${error.stack.split('\n').slice(0, 3).join('\n    ')}`);
  }
}

// 2026-11-22 is a Sunday: the week is Nov 22–28
const WEEK = '2026-11-22';
//                Sun     Mon     Tue       Wed     Thu       Fri     Sat
const DAYS = ['rest', 'lift', 'cardio', 'lift', 'cardio', 'lift', 'both'];
// Three lifting days for four lifts: they can't have fixed days, so they rotate
const DAYS3 = ['rest', 'lift', 'cardio', 'lift', 'cardio', 'lift', 'cardio'];

const LIFTS = [
  { exercise_id: 1, exercise_name: 'Barbell Squat', training_max: 300 },
  { exercise_id: 2, exercise_name: 'Barbell Bench Press', training_max: 200 },
  { exercise_id: 3, exercise_name: 'Barbell Deadlift', training_max: 400 },
  { exercise_id: 4, exercise_name: 'Barbell Overhead Press', training_max: 120 },
];
const program531 = (extra = {}) => ({
  id: 1, name: 'BBB', type: '531', current_week: 2, current_cycle: 1, week_started_on: null,
  lifts: LIFTS, statuses: new Map(), ...extra,
});
const lift = (id, date, exerciseIds) => ({ id, date, kind: 'strength', duration_minutes: 60, exercise_ids: exerciseIds, exercise_names: [] });
const run = (id, date, km) => ({ id, date, kind: 'cardio', sport: 'run', duration_s: km * 300, distance_m: km * 1000, exercise_ids: [], exercise_names: [] });
const day = (week, date) => week.days.find((d) => d.date === date);

async function unitTests() {
  console.log('\nSchedule helpers');

  await test('schedules must be 7 known slots', () => {
    assert.deepEqual(normalizeDays(DAYS), DAYS);
    assert.equal(normalizeDays(DAYS.slice(1)), null);
    assert.equal(normalizeDays([...DAYS.slice(1), 'nap']), null);
    assert.equal(normalizeDays('lift'), null);
  });

  await test('weeks start on Sunday; overrides win over the weekday', () => {
    assert.equal(weekStartFor('2026-11-25'), WEEK);
    assert.equal(weekStartFor(WEEK), WEEK);
    assert.equal(slotFor('2026-11-25', DAYS), 'lift');
    assert.equal(slotFor('2026-11-25', DAYS, new Map([['2026-11-25', 'rest']])), 'rest');
  });

  await test('lift order puts listed lifts first, the rest in program order', () => {
    assert.deepEqual(orderedLifts(LIFTS, [4, '3']).map((l) => l.exercise_id), [4, 3, 1, 2]);
    assert.deepEqual(orderedLifts(LIFTS).map((l) => l.exercise_id), [1, 2, 3, 4]);
  });

  await test('lifts per day', () => {
    assert.equal(liftsPerDay(4, 4), 1);
    assert.equal(liftsPerDay(4, 3), 1); // 3-day 5/3/1 rotates through the lifts
    assert.equal(liftsPerDay(4, 2), 2);
    assert.equal(liftsPerDay(4, 0), 1);
  });

  console.log('\nBuilding a week');

  await test('without a schedule nothing is planned', () => {
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-23', days: null, program: program531(), sessions: [run(9, '2026-11-24', 5)] });
    assert.equal(week.configured, false);
    assert.ok(week.days.every((d) => d.slot === 'flex' && d.planned.length === 0));
    assert.equal(day(week, '2026-11-24').sessions.length, 1);
  });

  await test('5/3/1 lifts fill lifting days in order, Monday first', () => {
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, program: program531() });
    const titles = week.days.filter((d) => d.planned.some((p) => p.kind === 'strength'))
      .map((d) => [d.weekday, d.planned.find((p) => p.kind === 'strength').title]);
    assert.deepEqual(titles, [['Monday', 'Squat'], ['Wednesday', 'Bench Press'], ['Friday', 'Deadlift'], ['Saturday', 'Overhead Press']]);
    const monday = day(week, '2026-11-23').planned[0];
    assert.equal(monday.status, 'upcoming');
    assert.equal(monday.detail, 'Week 2 · 3s');
    // Week 2 top set: 90% of 300 = 270 x 3+
    assert.deepEqual(monday.lifts[0].top_set, { weight: 270, reps: 3, amrap: true });
    assert.deepEqual(day(week, '2026-11-28').planned.map((p) => p.kind), ['strength', 'cardio']);
    assert.deepEqual(day(week, WEEK).planned, []);
  });

  await test('the lift order is used', () => {
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, program: program531(), liftOrder: [4, 3, 2, 1] });
    assert.equal(day(week, '2026-11-23').planned[0].title, 'Overhead Press');
  });

  console.log('\nFixed lift days (4 lifts on 4 lifting days)');

  // Lift Mon, Tue (+ cardio), Thu, Fri (+ cardio); cardio Wed, Sat; rest Sun
  const USER = ['rest', 'lift', 'both', 'cardio', 'lift', 'both', 'cardio'];

  await test('each lift keeps its own day; one done early shows as done on its day', () => {
    assert.equal(fixedLiftsPerDay(program531(), USER), 1);
    // Bench already done on Sunday; today is Monday
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-23', days: USER, program: program531(), sessions: [lift(10, WEEK, [2])] });
    const lifting = week.days.filter((d) => d.planned.some((p) => p.kind === 'strength')).map((d) => [d.weekday, d.planned[0].title, d.planned[0].status]);
    assert.deepEqual(lifting, [
      ['Monday', 'Squat', 'today'], ['Tuesday', 'Bench Press', 'done'], ['Thursday', 'Deadlift', 'upcoming'], ['Friday', 'Overhead Press', 'upcoming'],
    ]);
    const tuesday = day(week, '2026-11-24').planned[0];
    assert.equal(tuesday.detail, 'Week 2 · 3s · done Sun');
    assert.deepEqual(tuesday.workout_ids, [10]);
    assert.equal(week.program.fixed_days, true);
    // Next week: the same days, the next program week
    const next = buildWeek({ weekStart: '2026-11-29', today: '2026-11-23', days: USER, program: program531(), sessions: [lift(10, WEEK, [2])] });
    assert.equal(day(next, '2026-11-30').planned[0].title, 'Squat');
    assert.equal(day(next, '2026-11-30').planned[0].detail, 'Week 3 · 5/3/1');
    assert.equal(day(next, '2026-12-01').planned[0].title, 'Bench Press');
  });

  await test('a missed lift stays on its day and doesn\'t move the others', () => {
    // Today is Thursday; nothing lifted Monday or Tuesday
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-26', days: USER, program: program531(), sessions: [run(11, '2026-11-25', 8)] });
    assert.deepEqual(day(week, '2026-11-23').planned.map((p) => [p.title, p.status]), [['Squat', 'missed']]);
    assert.equal(day(week, '2026-11-24').planned[0].status, 'missed');
    assert.deepEqual([day(week, '2026-11-26').planned[0].title, day(week, '2026-11-26').planned[0].status], ['Deadlift', 'today']);
    assert.equal(day(week, '2026-11-27').planned[0].title, 'Overhead Press');
    assert.equal(week.summary.missed, 3); // squat, bench and Tuesday's cardio
  });

  await test('a lift done on another day counts for its own day', () => {
    // Squat done on Tuesday instead of Monday
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-25', days: USER, program: program531(), sessions: [lift(10, '2026-11-24', [1])] });
    assert.deepEqual([day(week, '2026-11-23').planned[0].status, day(week, '2026-11-23').planned[0].detail], ['done', 'Week 2 · 3s · done Tue']);
    assert.equal(day(week, '2026-11-24').planned[0].title, 'Bench Press');
    assert.equal(day(week, '2026-11-24').planned[0].status, 'missed');
  });

  await test('marked lifts are done even without a workout', () => {
    const statuses = new Map([[1, 'completed'], [3, 'failed']]);
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, program: program531({ statuses }) });
    assert.equal(day(week, '2026-11-23').planned[0].status, 'done');
    assert.equal(day(week, '2026-11-25').planned[0].status, 'upcoming');
    assert.equal(day(week, '2026-11-27').planned[0].status, 'done');
  });

  await test('after the deload the next cycle has no weights yet', () => {
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, program: program531({ current_week: 4 }) });
    assert.equal(day(week, '2026-11-28').planned[0].detail, 'Week 4 · Deload');
    const nextWeek = buildWeek({ weekStart: '2026-11-29', today: WEEK, days: DAYS, program: program531({ current_week: 4 }) });
    const monday = day(nextWeek, '2026-11-30').planned[0];
    assert.equal(monday.title, 'Squat');
    assert.equal(monday.detail, 'Week 1 · 5s · cycle 2');
    assert.equal(monday.lifts[0].top_set, null);
  });

  await test('a week finished early: the rest of this week is done, the next week starts next week', () => {
    // Week 2 was completed on Thursday, so the program is on week 3 from Thursday
    const program = program531({ current_week: 3, week_started_on: '2026-11-26' });
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-27', days: USER, program, sessions: [lift(10, '2026-11-26', [3, 4])] });
    const friday = day(week, '2026-11-27').planned[0];
    assert.deepEqual([friday.title, friday.status], ['Overhead Press', 'done']);
    assert.equal(friday.detail, 'Week 2 · 3s');
    const next = buildWeek({ weekStart: '2026-11-29', today: '2026-11-27', days: USER, program });
    assert.equal(day(next, '2026-11-30').planned[0].detail, 'Week 3 · 5/3/1');
  });

  await test('the run planner sees the same fixed days', () => {
    const projection = projectLiftDays({ from: '2026-11-23', until: '2026-12-31', days: USER, program: program531(), today: '2026-11-23' });
    const heavy = projection.days.filter((d) => d.heavy_legs).map((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay());
    assert.ok(heavy.every((wd) => wd === 1 || wd === 4), `heavy legs on ${heavy}`);
    assert.equal(projection.days.filter((d) => d.date <= '2026-11-29').length, 4);
    // Program week 4 (the deload) lands two weeks after this one
    assert.deepEqual([...projection.deloadWeekStarts], ['2026-12-06']);
  });

  await test('a skipped lift shows as skipped, not missed, and its day stops counting as heavy legs', () => {
    // Injured foot: squat and deadlift skipped this week
    const statuses = new Map([[1, 'skipped'], [3, 'skipped']]);
    const week = buildWeek({ weekStart: WEEK, today: '2026-11-27', days: USER, program: program531({ statuses }), sessions: [lift(10, '2026-11-24', [2])] });
    assert.deepEqual(day(week, '2026-11-23').planned.map((p) => [p.title, p.status]), [['Squat', 'skipped']]);
    assert.equal(day(week, '2026-11-26').planned[0].status, 'skipped');
    assert.equal(day(week, '2026-11-24').planned[0].status, 'done');
    // Skipped lifts aren't planned work (bench done, OHP today) and aren't missed: only Tuesday's and Wednesday's cardio were
    assert.equal(week.summary.strength.planned, 2);
    assert.equal(week.summary.missed, 2);
    const projection = projectLiftDays({ from: '2026-11-23', until: '2026-12-06', days: USER, program: program531({ statuses }), today: '2026-11-23' });
    const heavy = projection.days.filter((d) => d.heavy_legs).map((d) => d.date);
    // Only next week's squat and deadlift are heavy
    assert.deepEqual(heavy, ['2026-11-30', '2026-12-03']);
  });

  await test('paused lifts stay on their day as skipped, every week, and never count as heavy legs', () => {
    const lifts = LIFTS.map((l) => (l.exercise_id === 1 || l.exercise_id === 3 ? { ...l, paused: 1 } : l));
    // This week the pause has skipped them already
    const statuses = new Map([[1, 'skipped'], [3, 'skipped']]);
    const program = program531({ lifts, statuses });
    const next = buildWeek({ weekStart: '2026-11-29', today: '2026-11-24', days: USER, program });
    const monday = day(next, '2026-11-30').planned[0];
    assert.deepEqual([monday.title, monday.status], ['Squat', 'skipped']);
    assert.equal(monday.paused, true);
    assert.equal(monday.detail, 'Week 3 · 5/3/1');
    assert.equal(day(next, '2026-12-01').planned[0].status, 'upcoming');
    assert.equal(day(next, '2026-12-03').planned[0].status, 'skipped');
    assert.deepEqual(buildWeek({ weekStart: WEEK, today: '2026-11-24', days: USER, program }).program.paused, ['Squat', 'Deadlift']);
    const projection = projectLiftDays({ from: '2026-11-23', until: '2027-01-31', days: USER, program, today: '2026-11-24' });
    assert.ok(projection.days.length > 30);
    assert.ok(projection.days.every((d) => !d.heavy_legs));
  });

  await test('paused lifts leave a rotating schedule', () => {
    const lifts = LIFTS.map((l) => (l.exercise_id === 1 ? { ...l, paused: 1 } : l));
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS3, program: program531({ lifts, statuses: new Map([[1, 'skipped']]) }) });
    const titles = week.days.flatMap((d) => d.planned.filter((p) => p.kind === 'strength').map((p) => p.title));
    assert.deepEqual(titles, ['Bench Press', 'Deadlift', 'Overhead Press']);
    const next = buildWeek({ weekStart: '2026-11-29', today: WEEK, days: DAYS3, program: program531({ lifts, statuses: new Map([[1, 'skipped']]) }) });
    assert.ok(!next.days.some((d) => d.planned.some((p) => p.title === 'Squat')));
  });

  console.log('\nQueue (4 lifts on 3 lifting days)');

  await test('done, missed and rolled-forward lifts', () => {
    assert.equal(fixedLiftsPerDay(program531(), DAYS3), null);
    // Monday: squat done. Wednesday missed. Today is Thursday.
    const week = buildWeek({
      weekStart: WEEK, today: '2026-11-26', days: DAYS3, program: program531(),
      sessions: [lift(10, '2026-11-23', [1]), run(11, '2026-11-24', 8)],
    });
    const monday = day(week, '2026-11-23');
    assert.equal(monday.planned[0].status, 'done');
    assert.equal(monday.planned[0].title, 'Squat');
    assert.deepEqual(monday.planned[0].workout_ids, [10]);
    assert.equal(monday.sessions[0].program[0].name, 'Barbell Squat');
    assert.equal(monday.sessions[0].program[0].status, null); // not marked in Program Week yet
    assert.equal(day(week, '2026-11-24').planned[0].status, 'done');
    assert.equal(day(week, '2026-11-25').planned[0].status, 'missed');
    // Bench moves to Friday
    assert.equal(day(week, '2026-11-27').planned[0].title, 'Bench Press');
    assert.deepEqual(week.summary.strength, { planned: 3, done: 1, sessions: 1, duration_s: 3600 });
    assert.equal(week.summary.cardio.distance_m, 8000);
    assert.equal(week.summary.missed, 1);
    assert.equal(week.program.unmarked, 1);
    assert.equal(week.program.fixed_days, false);
  });

  await test('marked lifts are done; the queue moves on to next week\'s lifts', () => {
    const statuses = new Map([[1, 'completed'], [2, 'completed'], [3, 'failed']]);
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS3, program: program531({ statuses }) });
    assert.equal(day(week, '2026-11-23').planned[0].title, 'Overhead Press');
    const wednesday = day(week, '2026-11-25').planned[0];
    assert.equal(wednesday.title, 'Squat');
    assert.equal(wednesday.detail, 'Week 3 · 5/3/1');
    assert.deepEqual(wednesday.lifts[0].top_set, { weight: 285, reps: 1, amrap: true });
  });

  await test('a future week continues the queue from today', () => {
    // Today is Friday with deadlift and OHP left: Friday takes deadlift, next Monday OHP
    const statuses = new Map([[1, 'completed'], [2, 'completed']]);
    const next = buildWeek({ weekStart: '2026-11-29', today: '2026-11-27', days: DAYS3, program: program531({ statuses }) });
    assert.equal(day(next, '2026-11-30').planned[0].title, 'Overhead Press');
    assert.equal(day(next, '2026-12-02').planned[0].title, 'Squat');
    assert.equal(day(next, '2026-12-02').planned[0].detail, 'Week 3 · 5/3/1');
    assert.equal(day(next, '2026-11-30').planned[0].status, 'upcoming');
  });

  await test('lifts from before the program week began do not count', () => {
    // Week 2 began Monday (after Monday's session finished week 1); Tuesday's squat counts, Monday's bench doesn't
    const week = buildWeek({
      weekStart: WEEK, today: '2026-11-26', days: DAYS3,
      program: program531({ week_started_on: '2026-11-23' }),
      sessions: [lift(10, '2026-11-23', [2]), lift(11, '2026-11-24', [1])],
    });
    assert.deepEqual(day(week, '2026-11-24').sessions[0].program.map((u) => u.name), ['Barbell Squat']);
    assert.deepEqual(day(week, '2026-11-23').sessions[0].program, []);
    assert.equal(day(week, '2026-11-26').planned.length, 1); // Thursday is a cardio day
    assert.equal(day(week, '2026-11-27').planned[0].title, 'Bench Press');
  });

  await test('a lifting day done today takes nothing from the queue', () => {
    const week = buildWeek({
      weekStart: WEEK, today: '2026-11-23', days: DAYS3, program: program531(),
      sessions: [lift(10, '2026-11-23', [1])],
    });
    assert.equal(day(week, '2026-11-23').planned[0].status, 'done');
    assert.equal(day(week, '2026-11-25').planned[0].title, 'Bench Press');
  });

  await test('two lifting days a week take two lifts each', () => {
    const twoDays = ['rest', 'lift', 'cardio', 'rest', 'lift', 'cardio', 'rest'];
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: twoDays, program: program531() });
    assert.equal(day(week, '2026-11-23').planned[0].title, 'Squat + Bench Press');
    assert.equal(day(week, '2026-11-26').planned[0].title, 'Deadlift + Overhead Press');
  });

  await test('overrides move a lifting day', () => {
    const overrides = new Map([['2026-11-25', 'rest'], ['2026-11-26', 'lift']]);
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, overrides, program: program531() });
    assert.deepEqual(day(week, '2026-11-25').planned, []);
    assert.equal(day(week, '2026-11-25').overridden, true);
    assert.equal(day(week, '2026-11-26').planned[0].title, 'Bench Press');
  });

  await test('Starting Strength alternates A and B, one session a day', () => {
    const ss = { ...program531({ type: 'starting_strength', current_week: 7, current_cycle: 2 }) };
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS, program: ss });
    const monday = day(week, '2026-11-23').planned[0];
    assert.equal(monday.title, 'Workout B');
    assert.equal(monday.detail, 'Session 7');
    assert.deepEqual(monday.lifts.map((l) => l.name), ['Barbell Squat', 'Barbell Overhead Press', 'Barbell Deadlift']);
    assert.deepEqual(monday.lifts[0].top_set, { weight: 300, reps: 5, amrap: false });
    assert.equal(day(week, '2026-11-25').planned[0].title, 'Workout A');
    assert.equal(day(week, '2026-11-25').planned[0].lifts[0].top_set, null);
  });

  await test('a Starting Strength session needs two of its lifts to count', () => {
    const ss = program531({ type: 'starting_strength', current_week: 7, current_cycle: 2 });
    const squatOnly = buildWeek({ weekStart: WEEK, today: '2026-11-24', days: DAYS, program: ss, sessions: [lift(10, '2026-11-23', [1])] });
    assert.equal(day(squatOnly, '2026-11-25').planned[0].title, 'Workout B');
    const full = buildWeek({ weekStart: WEEK, today: '2026-11-24', days: DAYS, program: ss, sessions: [lift(10, '2026-11-23', [1, 4, 3])] });
    assert.equal(day(full, '2026-11-23').planned[0].title, 'Squat + Overhead Press + Deadlift');
    assert.equal(day(full, '2026-11-25').planned[0].title, 'Workout A');
    assert.equal(full.program.ready_to_advance, true);
  });

  await test('past weeks show what happened, nothing queued', () => {
    const week = buildWeek({ weekStart: '2026-11-15', today: WEEK, days: DAYS, program: program531(), sessions: [lift(5, '2026-11-16', [1])] });
    assert.equal(day(week, '2026-11-16').planned[0].status, 'done');
    assert.equal(day(week, '2026-11-18').planned[0].status, 'missed');
    assert.equal(day(week, '2026-11-18').planned[0].title, 'Lift');
  });

  await test('without a program, lifting days are generic', () => {
    const week = buildWeek({ weekStart: WEEK, today: WEEK, days: DAYS });
    assert.equal(day(week, '2026-11-23').planned[0].title, 'Lift');
    assert.equal(week.program, null);
  });
}

// ---------------------------------------------------------------------------

async function startApp(dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
      JWT_SECRET: Buffer.from('test-secret-for-week-tests').toString('base64'),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });

  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return { child, base, output: () => output };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`App server did not start:\n${output}`);
}

function api(base, token) {
  return async (method, endpoint, data) => {
    const response = await fetch(`${base}/api${endpoint}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
}

async function apiTests() {
  console.log('\n/api/week routes');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'week-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));

  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'week@test.local', password: 'secret123', username: 'tester', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);
    const other = await anon('POST', '/auth/register', { email: 'other@test.local', password: 'secret123', username: 'other', units: 'kg' });
    const callOther = api(app.base, other.body.token);

    const exercises = (await call('GET', '/exercises')).body;
    const list = Array.isArray(exercises) ? exercises : exercises.exercises;
    const idOf = (name) => list.find((e) => e.name === name).id;
    const squat = idOf('Barbell Squat');
    const bench = idOf('Barbell Bench Press');
    const deadlift = idOf('Barbell Deadlift');
    const ohp = idOf('Barbell Overhead Press');
    let programId;

    await test('needs a login', async () => {
      assert.equal((await anon('GET', '/week')).status, 401);
    });

    await test('no schedule yet', async () => {
      const r = await call('GET', `/week?localDate=2026-11-23`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.configured, false);
      assert.equal(r.body.week_start, WEEK);
      assert.equal(r.body.load, null);
      const s = await call('GET', '/week/schedule');
      assert.deepEqual(s.body, { days: null, lift_order: [], program: null, program_lifts: [] });
    });

    await test('schedule is validated and saved', async () => {
      assert.equal((await call('PUT', '/week/schedule', { days: DAYS.slice(1) })).status, 400);
      assert.equal((await call('PUT', '/week/schedule', { days: DAYS, lift_order: ['x'] })).status, 400);
      const r = await call('PUT', '/week/schedule', { days: DAYS, lift_order: [ohp, ohp, squat] });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { days: DAYS, lift_order: [ohp, squat] });
      assert.equal((await callOther('GET', '/week/schedule')).body.days, null);
    });

    await test('the active program fills lifting days', async () => {
      const p = await call('POST', '/programs', {
        name: 'BBB', type: '531',
        lifts: [squat, bench, deadlift, ohp].map((exercise_id, i) => ({ exercise_id, training_max: [300, 200, 400, 120][i] })),
      });
      assert.equal(p.status, 201, JSON.stringify(p.body));
      programId = p.body.id;
      const r = await call('GET', '/week?localDate=2026-11-22');
      assert.equal(r.body.configured, true);
      assert.equal(r.body.program.position, 'Week 1 · Cycle 1');
      const monday = r.body.days[1].planned[0];
      assert.equal(monday.title, 'Overhead Press');
      assert.deepEqual(monday.lifts[0].top_set, { weight: 102.5, reps: 5, amrap: true });
      assert.equal(r.body.days[3].planned[0].title, 'Squat');
      const s = await call('GET', '/week/schedule');
      assert.equal(s.body.program_lifts.length, 4);
    });

    await test('logged sessions tick off the plan', async () => {
      const w = await call('POST', '/workouts', { date: '2026-11-23', duration_minutes: 60, sets: [{ exercise_id: ohp, set_number: 1, reps: 5, weight: 100 }] });
      assert.equal(w.status, 201, JSON.stringify(w.body));
      const c = await call('POST', '/cardio', { date: '2026-11-24', sport: 'run', duration_s: 1800, distance_m: 5000 });
      assert.equal(c.status, 201, JSON.stringify(c.body));
      const r = await call('GET', '/week?localDate=2026-11-25');
      const [, monday, tuesday, wednesday] = r.body.days;
      assert.equal(monday.planned[0].status, 'done');
      assert.equal(monday.sessions[0].program[0].name, 'Barbell Overhead Press');
      assert.equal(tuesday.planned[0].status, 'done');
      assert.equal(tuesday.sessions[0].distance_m, 5000);
      assert.equal(wednesday.planned[0].status, 'today');
      assert.equal(wednesday.planned[0].title, 'Squat');
      assert.equal(r.body.summary.cardio.distance_m, 5000);
      assert.equal(r.body.program.unmarked, 1);
    });

    await test('a day can be changed for one date, then reset', async () => {
      assert.equal((await call('PUT', '/week/days/2026-11-25', { slot: 'nap' })).status, 400);
      assert.equal((await call('PUT', '/week/days/not-a-date', { slot: 'rest' })).status, 400);
      assert.equal((await call('PUT', '/week/days/2026-11-25', { slot: 'rest' })).status, 200);
      let r = await call('GET', '/week?localDate=2026-11-25');
      assert.equal(r.body.days[3].slot, 'rest');
      assert.equal(r.body.days[3].overridden, true);
      assert.equal(r.body.days[5].planned[0].title, 'Squat');
      assert.equal((await call('DELETE', '/week/days/2026-11-25')).status, 200);
      r = await call('GET', '/week?localDate=2026-11-25');
      assert.equal(r.body.days[3].slot, 'lift');
    });

    await test('completing a program week records when the next one began', async () => {
      const a = await call('POST', `/programs/${programId}/advance-week`, { localDate: '2026-11-25' });
      assert.equal(a.status, 200, JSON.stringify(a.body));
      // Week 1 was finished on Wednesday: this week's lifting days show it done,
      // and week 2 starts next week on the same days
      const r = await call('GET', '/week?localDate=2026-11-25');
      assert.equal(r.body.program.position, 'Week 2 · Cycle 1');
      assert.equal(r.body.days[1].sessions[0].program.length, 0);
      assert.deepEqual([r.body.days[3].planned[0].title, r.body.days[3].planned[0].status], ['Squat', 'done']);
      const next = await call('GET', '/week?start=2026-11-29&localDate=2026-11-25');
      assert.equal(next.body.days[1].planned[0].title, 'Overhead Press');
      assert.equal(next.body.days[1].planned[0].detail, 'Week 2 · 3s');
    });

    await test('other weeks', async () => {
      const r = await call('GET', '/week?start=2026-12-02&localDate=2026-11-25');
      assert.equal(r.body.week_start, '2026-11-29');
      assert.ok(r.body.days.every((d) => d.planned.every((p) => p.status === 'upcoming')));
      const past = await call('GET', '/week?start=2026-11-15&localDate=2026-11-25');
      assert.equal(past.body.days[1].planned[0].status, 'missed');
    });

    await test('a skipped 5/3/1 lift keeps its training max at the end of the cycle', async () => {
      const p = await call('POST', '/programs', {
        name: 'Injury block', type: '531',
        lifts: [[squat, 300], [bench, 200], [deadlift, 400], [ohp, 120]].map(([exercise_id, training_max]) => ({ exercise_id, training_max })),
      });
      const id = p.body.id;
      for (let week = 1; week <= 4; week++) {
        for (const ex of [squat, deadlift]) await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'skipped' });
        for (const ex of [bench, ohp]) {
          await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'completed', ...(week === 3 ? { amrap_reps: 6 } : {}) });
        }
        assert.equal((await call('POST', `/programs/${id}/advance-week`, { localDate: '2026-11-25' })).status, 200);
      }
      const after = await call('GET', `/programs/${id}`);
      const tm = Object.fromEntries(after.body.lifts.map((l) => [l.exercise_id, l.training_max]));
      assert.deepEqual([tm[squat], tm[deadlift]], [300, 400]); // skipped: unchanged
      assert.deepEqual([tm[bench], tm[ohp]], [205, 125]); // progressed
      assert.equal(after.body.current_cycle, 2);
    });

    await test('a skipped Starting Strength lift keeps its weight', async () => {
      const p = await call('POST', '/programs', {
        name: 'SS', type: 'starting_strength',
        lifts: [[squat, 200], [bench, 150], [deadlift, 250], [ohp, 95]].map(([exercise_id, training_max]) => ({ exercise_id, training_max })),
      });
      const id = p.body.id;
      await call('PUT', `/programs/${id}/lifts/${squat}/status`, { status: 'skipped' });
      await call('PUT', `/programs/${id}/lifts/${bench}/status`, { status: 'completed' });
      await call('PUT', `/programs/${id}/lifts/${deadlift}/status`, { status: 'skipped' });
      await call('POST', `/programs/${id}/advance-week`, { localDate: '2026-11-25' });
      const after = await call('GET', `/programs/${id}`);
      const w = Object.fromEntries(after.body.lifts.map((l) => [l.exercise_id, l.training_max]));
      assert.deepEqual([w[squat], w[deadlift], w[bench]], [200, 250, 155]);
    });

    await test('a paused lift is skipped every week until resumed, keeping its training max', async () => {
      const p = await call('POST', '/programs', {
        name: 'Pause block', type: '531',
        lifts: [[squat, 300], [bench, 200], [deadlift, 400], [ohp, 120]].map(([exercise_id, training_max]) => ({ exercise_id, training_max })),
      });
      const id = p.body.id;
      assert.equal((await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: 'yes' })).status, 400);
      assert.equal((await callOther('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: true })).status, 403);
      const paused = await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: true });
      assert.deepEqual(paused.body, { exercise_id: squat, paused: true });
      for (let week = 1; week <= 4; week++) {
        const current = await call('GET', `/programs/${id}/current-week`);
        const squatLift = current.body.lifts.find((l) => l.exercise_id === squat);
        assert.equal(squatLift.paused, true);
        assert.equal(squatLift.status, 'skipped', `week ${week}`);
        for (const ex of [bench, deadlift, ohp]) await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'completed', ...(week === 3 ? { amrap_reps: 6 } : {}) });
        await call('POST', `/programs/${id}/advance-week`, { localDate: '2026-11-25' });
      }
      let tm = Object.fromEntries((await call('GET', `/programs/${id}`)).body.lifts.map((l) => [l.exercise_id, l.training_max]));
      assert.equal(tm[squat], 300);
      assert.equal(tm[bench], 205);
      // Still paused in the new cycle, until resumed; resuming clears this week's automatic skip
      assert.equal((await call('GET', `/programs/${id}/current-week`)).body.lifts.find((l) => l.exercise_id === squat).status, 'skipped');
      await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: false });
      const resumed = (await call('GET', `/programs/${id}/current-week`)).body.lifts.find((l) => l.exercise_id === squat);
      assert.deepEqual([resumed.paused, resumed.status], [false, null]);
      // A skip the user chose themselves isn't cleared by resuming
      await call('PUT', `/programs/${id}/lifts/${bench}/status`, { status: 'skipped' });
      await call('PUT', `/programs/${id}/lifts/${bench}/pause`, { paused: true });
      await call('PUT', `/programs/${id}/lifts/${bench}/pause`, { paused: false });
      assert.equal((await call('GET', `/programs/${id}/current-week`)).body.lifts.find((l) => l.exercise_id === bench).status, 'skipped');
    });

    await test('training load appears once heart rate settings exist', async () => {
      const t = await call('POST', '/cardio/thresholds', { effective_date: '2026-01-01', max_hr: 190, resting_hr: 55 });
      assert.ok(t.status === 200 || t.status === 201, JSON.stringify(t.body));
      const r = await call('GET', '/week?localDate=2026-11-25');
      assert.ok(r.body.load.load > 0, JSON.stringify(r.body.load));
      assert.equal(r.body.load.usual, 0);
      assert.ok(r.body.load.form);
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll week tests passed');
process.exit(failures ? 1 : 0);
