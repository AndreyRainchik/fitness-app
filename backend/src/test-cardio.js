#!/usr/bin/env node
/**
 * Cardio tests: the training summary helpers, then the /api/cardio routes and
 * how cardio sessions show up in workout history, end to end against a
 * throwaway database.
 *
 *   npm run test:cardio
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { activityType, sessionSeconds, summarizeTraining } from './services/cardioStats.js';

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
  console.log('\nTraining summary helpers');

  const run = (date, duration_s, distance_m, extra = {}) => ({ date, kind: 'cardio', sport: 'run', duration_s, distance_m, duration_minutes: Math.round(duration_s / 60), ...extra });
  const lift = (date, duration_minutes) => ({ date, kind: 'strength', duration_minutes });

  await test('types and durations', () => {
    assert.equal(activityType(lift('2026-11-01', 60)), 'strength');
    assert.equal(activityType(run('2026-11-01', 60, 0)), 'run');
    assert.equal(activityType({ kind: 'cardio', sport: 'kayak' }), 'other');
    assert.equal(sessionSeconds(lift('2026-11-01', 45)), 2700);
    assert.equal(sessionSeconds(run('2026-11-01', 1801, 0)), 1801);
    assert.equal(sessionSeconds({ kind: 'strength', duration_minutes: null }), 0);
  });

  // 2026-11-21 is a Saturday, so this week is Nov 15–21
  const sessions = [
    lift('2026-11-02', 60),
    run('2026-11-03', 1800, 5000, { environment: 'outdoor', avg_hr: 150 }),
    run('2026-11-16', 3600, 10000, { environment: 'outdoor', avg_hr: 140 }),
    run('2026-11-17', 1200, null, { environment: 'indoor' }), // treadmill, no distance logged
    { date: '2026-11-18', kind: 'cardio', sport: 'boulder', duration_s: 5400, duration_minutes: 90, environment: 'indoor', avg_hr: 120 },
    lift('2026-11-19', 75),
    run('2026-11-22', 1800, 5000), // after "today": ignored
    run('2026-01-01', 1800, 5000), // before the range: ignored
  ];
  const summary = summarizeTraining(sessions, { today: '2026-11-21', weeks: 4 });

  await test('weekly minutes by type, oldest week first', () => {
    assert.equal(summary.weekly.length, 4);
    assert.equal(summary.weekly[0].weekStart, '2026-10-25');
    assert.deepEqual(summary.weekly[1], { weekStart: '2026-11-01', strength: 60, run: 30, ride: 0, row: 0, boulder: 0, other: 0 });
    assert.deepEqual(summary.weekly[3], { weekStart: '2026-11-15', strength: 75, run: 80, ride: 0, row: 0, boulder: 90, other: 0 });
  });

  await test('this week totals by type', () => {
    assert.equal(summary.thisWeek.sessions, 4);
    assert.equal(summary.thisWeek.duration_s, 3600 + 1200 + 5400 + 4500);
    assert.deepEqual(summary.thisWeek.byType.run, { sessions: 2, duration_s: 4800, distance_m: 10000 });
    assert.equal(summary.thisWeek.byType.strength.sessions, 1);
  });

  await test('per-sport totals keep pace honest and weight HR by time', () => {
    const runs = summary.sports.find((s) => s.sport === 'run');
    assert.equal(runs.sessions, 3);
    assert.equal(runs.indoor, 1);
    assert.equal(runs.outdoor, 2);
    assert.equal(runs.duration_s, 6600);
    assert.equal(runs.distance_m, 15000);
    assert.equal(runs.distance_duration_s, 5400); // the treadmill run without distance isn't in pace
    assert.equal(runs.longest_distance_m, 10000);
    assert.equal(runs.avg_hr, Math.round((150 * 1800 + 140 * 3600) / 5400));
    assert.deepEqual(summary.sports.map((s) => s.sport), ['run', 'boulder']);
    assert.deepEqual(summary.totals, { sessions: 6, cardio_sessions: 4, duration_s: 3600 + 6600 + 5400 + 4500, cardio_duration_s: 6600 + 5400 });
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
      JWT_SECRET: Buffer.from('test-secret-for-cardio-tests').toString('base64'),
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
  console.log('\n/api/cardio routes');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardio-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));

  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'cardio@test.local', password: 'secret123', username: 'tester', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);

    const other = await anon('POST', '/auth/register', { email: 'other@test.local', password: 'secret123', username: 'other', units: 'kg' });
    const callOther = api(app.base, other.body.token);

    const outdoorRun = {
      date: '2026-11-17', start_time: '2026-11-17T07:05:00-05:00', name: 'Easy run', sport: 'run',
      environment: 'outdoor', duration_s: 2730, distance_m: 8046.7, elevation_gain_m: 42, avg_cadence: 172,
      avg_hr: 148, max_hr: 171, calories: 610,
    };
    let runId;

    await test('logs a run with heart rate and calories', async () => {
      const r = await call('POST', '/cardio', outdoorRun);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const w = r.body.workout;
      runId = w.id;
      assert.equal(w.kind, 'cardio');
      assert.equal(w.duration_minutes, 46);
      assert.equal(w.start_time, outdoorRun.start_time);
      assert.equal(w.cardio.sport, 'run');
      assert.equal(w.cardio.distance_m, 8046.7);
      assert.equal(w.metrics.avg_hr, 148);
      assert.equal(w.metrics.calories, 610);
    });

    await test('bouldering ignores distance and HR is optional', async () => {
      const r = await call('POST', '/cardio', { date: '2026-11-18', sport: 'boulder', environment: 'indoor', duration_s: 5400, distance_m: 999 });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.workout.cardio.distance_m, null);
      assert.equal(r.body.workout.metrics, null);
    });

    await test('rejects bad input', async () => {
      const bad = [
        { ...outdoorRun, sport: 'swim' },
        { ...outdoorRun, duration_s: 0 },
        { ...outdoorRun, avg_hr: 400 },
        { ...outdoorRun, avg_hr: 160, max_hr: 150 },
        { ...outdoorRun, environment: 'space' },
        { ...outdoorRun, date: 'yesterday' },
      ];
      for (const body of bad) {
        const r = await call('POST', '/cardio', body);
        assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(body)}`);
        assert.ok(r.body.error);
      }
    });

    await test('history lists cardio with its numbers next to strength workouts', async () => {
      const lift = await call('POST', '/workouts', { date: '2026-11-19', name: 'Lower', duration_minutes: 70, sets: [{ exercise_id: 1, set_number: 1, reps: 5, weight: 225 }] });
      assert.equal(lift.status, 201);
      const r = await call('GET', '/workouts');
      assert.equal(r.status, 200);
      const byName = Object.fromEntries(r.body.workouts.map((w) => [w.name ?? w.sport, w]));
      assert.equal(byName['Easy run'].kind, 'cardio');
      assert.equal(byName['Easy run'].sport, 'run');
      assert.equal(byName['Easy run'].distance_m, 8046.7);
      assert.equal(byName['Easy run'].avg_hr, 148);
      assert.equal(byName['Easy run'].total_volume, null);
      assert.equal(byName.Lower.kind, 'strength');
      assert.equal(byName.Lower.sport, null);
      assert.equal(byName.Lower.total_volume, 1125);
    });

    await test('workout detail includes the cardio data', async () => {
      const r = await call('GET', `/workouts/${runId}`);
      assert.equal(r.body.workout.cardio.avg_cadence, 172);
      assert.deepEqual(r.body.workout.sets, []);
      const prs = await call('GET', `/workouts/${runId}/with-prs`);
      assert.equal(prs.status, 200);
      assert.equal(prs.body.workout.cardio.sport, 'run');
    });

    await test('updates a session, clearing metrics left blank', async () => {
      const r = await call('PUT', `/cardio/${runId}`, { ...outdoorRun, environment: 'indoor', distance_m: null, avg_hr: null, max_hr: null, calories: null, notes: 'Treadmill after all' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.workout.cardio.environment, 'indoor');
      assert.equal(r.body.workout.cardio.distance_m, null);
      assert.equal(r.body.workout.metrics, null);
      assert.equal(r.body.workout.notes, 'Treadmill after all');
    });

    await test('strength-only actions refuse cardio sessions', async () => {
      assert.equal((await call('POST', `/workouts/${runId}/sets`, { exercise_id: 1, set_number: 1, reps: 5, weight: 100 })).status, 400);
      assert.equal((await call('PUT', `/workouts/${runId}`, { sets: [] })).status, 400);
      assert.equal((await call('POST', `/templates/from-workout/${runId}`, { name: 'Nope' })).status, 400);
      const lifts = (await call('GET', '/workouts')).body.workouts.filter((w) => w.kind === 'strength');
      assert.equal((await call('PUT', `/cardio/${lifts[0].id}`, outdoorRun)).status, 400);
    });

    await test('other users cannot see or change the session', async () => {
      assert.equal((await callOther('PUT', `/cardio/${runId}`, outdoorRun)).status, 404);
      assert.equal((await callOther('GET', `/workouts/${runId}`)).status, 403);
    });

    await test('summary covers strength and cardio', async () => {
      const r = await call('GET', '/cardio/summary?localDate=2026-11-21&weeks=4');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const week = r.body.weekly.at(-1);
      assert.equal(week.weekStart, '2026-11-15');
      assert.equal(week.run, 46);
      assert.equal(week.boulder, 90);
      assert.equal(week.strength, 70);
      assert.deepEqual(r.body.sports.map((s) => s.sport), ['run', 'boulder']);
      assert.equal(r.body.thisWeek.sessions, 3);
    });

    await test('deleting a session removes its cardio rows', async () => {
      assert.equal((await call('DELETE', `/workouts/${runId}`)).status, 200);
      assert.equal((await call('GET', `/workouts/${runId}`)).status, 404);
      const r = await call('GET', '/cardio/summary?localDate=2026-11-21&weeks=4');
      assert.deepEqual(r.body.sports.map((s) => s.sport), ['boulder']);
    });

    await test('strength analytics still work with cardio in the history', async () => {
      const r = await call('GET', '/analytics/dashboard-summary?localDate=2026-11-21');
      assert.equal(r.status, 200);
      assert.equal(r.body.totalWorkouts, 2);
      assert.equal((await call('GET', '/analytics/strength-score')).status, 200);
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll cardio tests passed');
process.exit(failures ? 1 : 0);
