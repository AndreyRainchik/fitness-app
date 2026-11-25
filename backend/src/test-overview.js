#!/usr/bin/env node
/**
 * Analytics overview tests: the period-comparison helpers, then
 * /api/analytics/overview, and units, dates and best sets in the
 * strength-score, symmetry and lift-progression endpoints, end to end
 * against a throwaway database.
 *
 *   npm run test:overview
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findPRs, liftChange, muscleGroupSets, overviewFlags, overviewWindows, summarizePRs, totals, trainingSummary,
} from './services/strengthOverview.js';
import { calculateDots, estimate1RM, getStrengthStandard } from './utils/strengthCalculations.js';

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

// ---------------------------------------------------------------------------

async function unitTests() {
  console.log('\nOverview helpers');

  const TODAY = '2026-11-24';
  const windows = overviewWindows(TODAY, 4);
  let workoutId = 0;
  const set = (date, weight, reps, extra = {}) => ({ date, workout_id: ++workoutId, weight, reps, exercise_id: 1, exercise: 'Barbell Squat', ...extra });

  await test('windows: the last N weeks and the N weeks before, back to back', () => {
    assert.deepEqual(windows, {
      current: { start: '2026-10-27', end: '2026-11-24' },
      previous: { start: '2026-09-29', end: '2026-10-26' },
    });
  });

  await test('DOTS matches published values', () => {
    // A man's DOTS coefficient at 90 kg is about 0.6466, so a 600 kg total is about 388
    assert.equal(Math.round(calculateDots(600, 90, 'M')), 388);
    assert.ok(calculateDots(400, 60, 'F') > 400);
    assert.equal(calculateDots(0, 90, 'M'), 0);
    assert.equal(calculateDots(500, 0, 'M'), 0);
  });

  await test('strength standards: published classes, interpolation and clamping', () => {
    const at = (lift, bw, sex) => getStrengthStandard(lift, bw, sex, 0).standards;
    assert.deepEqual(at('Barbell Squat', 180, 'M'), { beginner: 169, novice: 228, intermediate: 298, advanced: 377, elite: 462 });
    assert.deepEqual(at('Barbell Bench Press', 140, 'F'), { beginner: 44, novice: 72, intermediate: 108, advanced: 152, elite: 201 });
    // Halfway between the 180 and 190 lb classes
    assert.deepEqual(at('Barbell Deadlift', 185, 'M'), { beginner: 208, novice: 276, intermediate: 357, advanced: 448, elite: 546 });
    // Outside the table: held at the heaviest or lightest class
    assert.deepEqual(at('Barbell Overhead Press', 400, 'M'), at('Barbell Overhead Press', 310, 'M'));
    assert.deepEqual(at('Barbell Squat', 70, 'F'), at('Barbell Squat', 90, 'F'));
    // Levels and percentiles at the thresholds
    const s = getStrengthStandard('Barbell Squat', 180, 'M', 298);
    assert.equal(s.level, 'Intermediate');
    assert.equal(s.percentile, 50);
    assert.deepEqual(s.nextLevel, { level: 'Advanced', weight: 377 });
    assert.equal(getStrengthStandard('Barbell Squat', 180, 'M', 500).level, 'Elite');
    assert.equal(getStrengthStandard('Barbell Squat', 180, null, 298).level, 'Intermediate', 'no sex set uses the men\'s table');
    assert.equal(getStrengthStandard('Leg Press', 180, 'M', 500).level, 'Unknown');
  });

  await test('lift change compares the best of each window', () => {
    const r = liftChange([
      set('2026-10-01', 280, 5),
      set('2026-10-20', 290, 5),
      set('2026-11-03', 300, 5),
      set('2026-11-20', 310, 5),
    ], windows, TODAY);
    assert.equal(r.current, Math.round(estimate1RM(310, 5) * 10) / 10);
    assert.equal(r.previous, Math.round(estimate1RM(290, 5) * 10) / 10);
    assert.ok(r.change > 0);
    assert.equal(r.status, 'up');
    assert.deepEqual(r.trend.map((p) => p.date), ['2026-11-03', '2026-11-20']);
    assert.equal(r.sessions, 2);
  });

  await test('a lift that keeps being trained without beating its best is stalled', () => {
    const r = liftChange([
      set('2026-10-10', 225, 5),
      set('2026-10-31', 220, 5),
      set('2026-11-10', 225, 4),
      set('2026-11-21', 220, 5),
    ], windows, TODAY);
    assert.equal(r.status, 'stalled');
    assert.equal(r.stalledWeeks, 6);
  });

  await test('statuses for new, untrained and missing lifts', () => {
    assert.equal(liftChange([set('2026-11-10', 100, 5)], windows, TODAY).status, 'new');
    const untrained = liftChange([set('2026-10-10', 100, 5)], windows, TODAY);
    assert.equal(untrained.status, 'notTrained');
    assert.equal(untrained.current, null);
    assert.equal(liftChange([], windows, TODAY).status, 'noData');
  });

  await test('PRs: beats every earlier set, the best one per day', () => {
    const sets = [
      set('2026-09-01', 200, 5),
      set('2026-11-01', 190, 5), // not a PR
      set('2026-11-05', 210, 5),
      { ...set('2026-11-05', 215, 5), workout_id: workoutId }, // same day, better
      set('2026-11-10', 100, 5, { exercise_id: 2, exercise: 'Barbell Row' }), // first time
    ];
    const prs = findPRs(sets, windows.current.start);
    assert.equal(prs.length, 2);
    const squat = prs.find((p) => p.exerciseId === 1);
    assert.equal(squat.weight, 215);
    assert.equal(squat.firstTime, false);
    const summary = summarizePRs(prs, windows.current);
    assert.equal(summary.count, 2);
    assert.equal(summary.exercises, 2);
    assert.equal(summary.biggest.exerciseId, 1);
    assert.ok(summary.biggest.gainPct > 0);
  });

  await test('total and DOTS need squat, bench and deadlift', () => {
    const lift = (current, previous) => ({ current, previous });
    const lifts = { squat: lift(300, 290), bench: lift(200, 200), deadlift: lift(400, 380), ohp: lift(null, null) };
    const t = totals(lifts, { current: 180, previous: 185 }, 'lbs', 'M');
    assert.equal(t.total.current, 900);
    assert.equal(t.total.change, 30);
    assert.ok(t.dots.change > 0);
    const missing = totals({ ...lifts, bench: lift(null, 200) }, { current: 180, previous: 185 }, 'lbs', 'M');
    assert.equal(missing.total.current, null);
    assert.equal(missing.dots.current, null);
    // kg users: the same lifts in kg give the same DOTS
    const kg = (v) => v / 2.20462;
    const inKg = totals({ squat: lift(kg(300), kg(290)), bench: lift(kg(200), kg(200)), deadlift: lift(kg(400), kg(380)), ohp: lift(null, null) },
      { current: kg(180), previous: kg(185) }, 'kg', 'M');
    assert.ok(Math.abs(inKg.dots.current - t.dots.current) < 0.2);
  });

  await test('training summary splits the windows and the session types', () => {
    const sessions = [
      { id: 1, date: '2026-10-01', kind: 'strength', duration_minutes: 60 },
      { id: 2, date: '2026-11-01', kind: 'strength', duration_minutes: 50 },
      { id: 3, date: '2026-11-02', kind: 'cardio', sport: 'run', duration_s: 1800, distance_m: 5000 },
      { id: 4, date: '2026-11-03', kind: 'cardio', sport: 'ride', duration_s: 3600, distance_m: 20000 },
    ];
    const s = trainingSummary(sessions, new Map([[1, 10000], [2, 12000]]), windows, 4);
    assert.equal(s.previous.sessions, 1);
    assert.equal(s.previous.volume, 10000);
    assert.equal(s.current.sessions, 3);
    assert.equal(s.current.strengthSessions, 1);
    assert.equal(s.current.cardioSessions, 2);
    assert.equal(s.current.strengthDurationS, 3000);
    assert.equal(s.current.cardioDurationS, 5400);
    assert.equal(s.current.runDistanceM, 5000);
    assert.equal(s.current.volume, 12000);
    assert.equal(s.current.perWeek, 0.8);
  });

  await test('muscle group sets per week, secondaries count half', () => {
    const rows = [
      ...Array(8).fill({ primary_muscle_group: 'Back', secondary_muscle_groups: '["Hamstrings","Glutes"]' }),
      ...Array(4).fill({ primary_muscle_group: 'Chest', secondary_muscle_groups: 'Triceps, Shoulders' }),
    ];
    const groups = Object.fromEntries(muscleGroupSets(rows, 4).map((g) => [g.muscleGroup, g.setsPerWeek]));
    assert.equal(groups.Back, 2);
    assert.equal(groups.Hamstrings, 1);
    assert.equal(groups.Chest, 1);
    assert.equal(groups.Triceps, 0.5);
  });

  await test('flags: stalled lifts, imbalances and low volume first, good news last', () => {
    const lift = (current, status = 'up', change = 5, extra = {}) => ({ current, status, change, ...extra });
    const lifts = {
      squat: lift(300),
      bench: lift(250, 'stalled', 0, { stalledWeeks: 5 }),
      deadlift: lift(400),
      ohp: lift(150),
    };
    const summary = { current: { strengthSessions: 12 } };
    const flags = overviewFlags({ lifts, muscleGroups: [
      ...['Chest', 'Back', 'Shoulders', 'Quadriceps'].map((m) => ({ muscleGroup: m, setsPerWeek: 12 })),
      { muscleGroup: 'Hamstrings', setsPerWeek: 2 },
    ], summary, weeks: 4 });
    assert.equal(flags[0].id, 'stalled-bench');
    assert.match(flags[0].title, /5 weeks/);
    assert.ok(flags.some((f) => f.tab === 'symmetry' && f.tone === 'warning' && /bench/i.test(f.title)), 'bench-to-squat imbalance');
    assert.deepEqual(flags.filter((f) => f.id.startsWith('volume-')).map((f) => f.id), ['volume-hamstrings']);
    assert.equal(flags.find((f) => f.id === 'volume-hamstrings').tab, null);
    assert.ok(!flags.some((f) => f.id === 'all-up'));

    const balanced = overviewFlags({
      lifts: { squat: lift(300), bench: lift(210), deadlift: lift(360), ohp: lift(135) },
      muscleGroups: [], summary: { current: { strengthSessions: 1 } }, weeks: 4,
    });
    assert.deepEqual(balanced.map((f) => f.id), ['balanced', 'all-up']);

    // A stalled lift that still beat last period's best doesn't count as "every lift went up"
    const mixed = overviewFlags({
      lifts: { squat: lift(300), bench: lift(210, 'stalled', 5, { stalledWeeks: 4 }), deadlift: lift(360), ohp: lift(135) },
      muscleGroups: [], summary: { current: { strengthSessions: 1 } }, weeks: 4,
    });
    assert.deepEqual(mixed.map((f) => f.id), ['stalled-bench', 'balanced']);
  });
}

// ---------------------------------------------------------------------------
// App server
// ---------------------------------------------------------------------------

async function startApp(dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
      JWT_SECRET: Buffer.from('test-secret-for-overview-tests').toString('base64'),
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
  console.log('\n/api/analytics/overview');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'overview-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));

  try {
    const anon = api(app.base);
    const register = async (email, units) => {
      const r = await anon('POST', '/auth/register', { email, password: 'secret123', username: email.split('@')[0], units });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return api(app.base, r.body.token);
    };
    const call = await register('lifter@test.local', 'lbs');
    const callKg = await register('metric@test.local', 'kg');

    const exercises = (await call('GET', '/exercises')).body;
    const list = Array.isArray(exercises) ? exercises : exercises.exercises;
    const id = (name) => list.find((e) => e.name === name).id;
    const lift = (name, weight, reps, n = 3) => Array.from({ length: n }, (_, i) => ({
      exercise_id: id(name), set_number: i + 1, reps, weight, is_warmup: false,
    }));
    const workout = (c, date, sets) => c('POST', '/workouts', { date, name: 'Lift', duration_minutes: 60, sets });

    for (const [date, squat, bench] of [['2026-10-06', 275, 205], ['2026-10-20', 285, 205], ['2026-11-03', 295, 205], ['2026-11-17', 305, 200]]) {
      const r = await workout(call, date, [
        ...lift('Barbell Squat', squat, 5), ...lift('Barbell Bench Press', bench, 5), ...lift('Barbell Deadlift', 365, 5),
      ]);
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    await call('POST', '/profile/bodyweight', { weight: 185, date: '2026-10-01', units: 'lbs' });
    await call('POST', '/profile/bodyweight', { weight: 181, date: '2026-11-20', units: 'lbs' });

    await test('compares the period with the one before', async () => {
      const r = await call('GET', '/analytics/overview?localDate=2026-11-24&weeks=4');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const { body } = r;
      assert.equal(body.units, 'lbs');
      assert.equal(body.weeks, 4);
      assert.equal(body.summary.current.strengthSessions, 2);
      assert.equal(body.summary.previous.strengthSessions, 2);
      assert.ok(body.summary.current.volume > body.summary.previous.volume);
      assert.equal(body.lifts.squat.status, 'up');
      assert.equal(body.lifts.squat.current, Math.round(estimate1RM(305, 5) * 10) / 10);
      assert.equal(body.lifts.ohp.status, 'noData');
      assert.equal(body.bodyweight.current, 181);
      assert.equal(body.bodyweight.previous, 185);
      assert.equal(body.bodyweight.change, -4);
      assert.ok(body.total.current > 0);
      assert.ok(body.dots.change > 0, 'more total at less bodyweight');
      assert.equal(body.prs.current.count, 2); // the two squat sessions
      assert.ok(Array.isArray(body.flags));
      assert.ok(body.muscleGroups.length > 0);
    });

    await test('clamps weeks and rejects anonymous calls', async () => {
      const r = await call('GET', '/analytics/overview?localDate=2026-11-24&weeks=500');
      assert.equal(r.body.weeks, 52);
      assert.equal((await anon('GET', '/analytics/overview')).status, 401);
    });

    await test('an empty history returns empty sections', async () => {
      const r = await callKg('GET', '/analytics/overview?localDate=2026-11-24');
      assert.equal(r.status, 200);
      assert.equal(r.body.units, 'kg');
      assert.equal(r.body.summary.current.sessions, 0);
      assert.equal(r.body.total.current, null);
      assert.equal(r.body.prs.current.count, 0);
      assert.deepEqual(r.body.flags, []);
    });

    await test('strength-score works out levels in the lifter\'s units', async () => {
      // The same squat, logged in lbs by one lifter and in kg by the other
      await workout(callKg, '2026-11-17', lift('Barbell Squat', Math.round(305 / 2.20462 * 10) / 10, 5));
      await callKg('PUT', '/profile', { bodyweight: 82, sex: 'M' });
      await call('PUT', '/profile', { bodyweight: 181, sex: 'M' });
      const lbs = (await call('GET', '/analytics/strength-score?localDate=2026-11-24&weeks=4')).body;
      const kg = (await callKg('GET', '/analytics/strength-score?localDate=2026-11-24&weeks=4')).body;
      assert.equal(lbs.units, 'lbs');
      assert.equal(kg.units, 'kg');
      assert.equal(kg.squat.standard, lbs.squat.standard);
      assert.ok(kg.squat.nextLevel.weight < lbs.squat.nextLevel.weight, 'next level in kg');
      assert.ok(Math.abs(kg.squat.nextLevel.weight * 2.20462 - lbs.squat.nextLevel.weight) < 1);
    });

    await test('the dashboard still lists recent PRs', async () => {
      const r = await call('GET', '/analytics/dashboard-summary?localDate=2026-11-24');
      assert.equal(r.status, 200);
      assert.ok(r.body.recentPRs.some((p) => p.exercise === 'Barbell Squat' && p.weight === 305));
    });

    console.log('\n/api/analytics symmetry and lift-progression');
    const kg = (lbs) => Math.round((lbs / 2.20462) * 100) / 100;
    // Registration is rate limited, so two lifters share these tests; the
    // later ones use 2025 dates so their sessions stay out of the 2026 ranges
    const lbsUser = await register('sym-lbs@test.local', 'lbs');
    const kgUser = await register('sym-kg@test.local', 'kg');
    await lbsUser('PUT', '/profile', { bodyweight: 180, sex: 'M' });
    await kgUser('PUT', '/profile', { bodyweight: kg(180), sex: 'M' });

    await test('symmetry gives kg and lbs lifters with the same lifts the same scores', async () => {
      const plan = [['Barbell Squat', 315], ['Barbell Bench Press', 225], ['Barbell Deadlift', 405], ['Barbell Overhead Press', 145]];
      await workout(lbsUser, '2026-11-20', plan.flatMap(([name, w]) => lift(name, w, 5, 1)));
      await workout(kgUser, '2026-11-20', plan.flatMap(([name, w]) => lift(name, kg(w), 5, 1)));
      const a = (await lbsUser('GET', '/analytics/symmetry?localDate=2026-11-24&weeks=4')).body;
      const b = (await kgUser('GET', '/analytics/symmetry?localDate=2026-11-24&weeks=4')).body;
      assert.deepEqual(b.ratios, a.ratios);
      for (const key of ['squat', 'bench', 'deadlift', 'ohp']) {
        assert.ok(a.lifts[key] > 0);
        assert.ok(Math.abs(a.lifts[key] - b.lifts[key]) < 0.2, `${key}: ${a.lifts[key]} vs ${b.lifts[key]}`);
      }
      assert.equal(b.overallScore, a.overallScore);
    });

    await test('symmetry uses the best estimated 1RM, not the heaviest weight', async () => {
      const c = lbsUser;
      await workout(c, '2025-06-20', [
        ...lift('Barbell Squat', 300, 1, 1),
        ...lift('Barbell Squat', 285, 8, 1), // about 354 estimated
        ...lift('Barbell Squat', 400, 0, 1), // a failed rep counts for nothing
        ...lift('Barbell Deadlift', 400, 1, 1),
      ]);
      const r = (await c('GET', '/analytics/symmetry?localDate=2025-06-24&weeks=4')).body;
      assert.equal(r.ratios.squatToDeadlift, Math.round((estimate1RM(285, 8) / 400) * 100) / 100);
    });

    await test('lift progression works out levels in the lifter\'s units', async () => {
      // The squats logged for the symmetry test above
      const a = (await lbsUser('GET', '/analytics/lift-progression/Barbell%20Squat?localDate=2026-11-24&weeks=4')).body;
      const b = (await kgUser('GET', '/analytics/lift-progression/Barbell%20Squat?localDate=2026-11-24&weeks=4')).body;
      assert.equal(a.units, 'lbs');
      assert.equal(b.units, 'kg');
      assert.equal(b.progression[0].standard, a.progression[0].standard);
      assert.equal(b.progression[0].percentile, a.progression[0].percentile);
      assert.ok(Math.abs(b.progression[0].wilksScore - a.progression[0].wilksScore) < 0.5);
    });

    await test('lift progression skips failed sets and judges each day at that day\'s bodyweight', async () => {
      const c = lbsUser;
      await c('POST', '/profile/bodyweight', { weight: 240, date: '2025-01-01', units: 'lbs' });
      await c('POST', '/profile/bodyweight', { weight: 165, date: '2025-02-15', units: 'lbs' });
      await workout(c, '2025-01-10', lift('Barbell Squat', 315, 5));
      await workout(c, '2025-02-20', [...lift('Barbell Squat', 315, 5), ...lift('Barbell Squat', 500, 0, 1)]);
      await workout(c, '2025-02-22', lift('Barbell Squat', 405, 0, 1)); // only a failed attempt
      const r = (await c('GET', '/analytics/lift-progression/Barbell%20Squat?localDate=2025-02-24&weeks=12')).body;
      assert.deepEqual(r.progression.map((p) => p.date), ['2025-01-10', '2025-02-20']);
      const [heavy, light] = r.progression;
      assert.equal(heavy.estimated1RM, light.estimated1RM);
      assert.ok(light.percentile > heavy.percentile, 'the same lift is stronger at a lower bodyweight');
      assert.ok(light.wilksScore > heavy.wilksScore);
    });

    await test('a malformed localDate falls back to today instead of failing', async () => {
      for (const endpoint of ['/analytics/lift-progression/Barbell%20Squat', '/analytics/symmetry', '/analytics/strength-score']) {
        const r = await call('GET', `${endpoint}?localDate=not-a-date&weeks=abc`);
        assert.equal(r.status, 200, `${endpoint}: ${JSON.stringify(r.body)}`);
        assert.equal(r.body.weeks, 12);
      }
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll overview tests passed');
process.exit(failures ? 1 : 0);
