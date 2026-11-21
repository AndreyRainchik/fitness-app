#!/usr/bin/env node
/**
 * Hevy import tests: conversion helpers, then the /api/hevy routes end to end
 * against a fake Hevy API. Uses a throwaway database; no real Hevy key needed.
 *
 *   npm run test:hevy
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  convertHevyWorkout, convertWeight, createExerciseMatcher, localDate, newExerciseFromTemplate, normalizeExerciseName,
} from './services/hevyImport.js';
import { mergeWeight, pushBodyweight, toKg } from './services/hevyWeightSync.js';
import { HevyApiError } from './services/hevyClient.js';

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
// Fake Hevy data
// ---------------------------------------------------------------------------

const VALID_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee1234';

const hevyWorkouts = [
  {
    id: 'w-push',
    title: 'Push Day',
    description: 'Felt strong',
    start_time: '2026-11-18T23:30:00Z', // 6:30 PM on the 18th in New York
    end_time: '2026-11-19T00:45:00Z',
    updated_at: '2026-11-19T00:46:00Z',
    created_at: '2026-11-19T00:46:00Z',
    exercises: [
      {
        index: 0, title: 'Bench Press (Barbell)', notes: 'Paused reps', exercise_template_id: 'T-BENCH', superset_id: null,
        sets: [
          { index: 0, type: 'warmup', weight_kg: 20.4117, reps: 10, rpe: null },
          { index: 1, type: 'normal', weight_kg: 61.235, reps: 5, rpe: null },
          { index: 2, type: 'failure', weight_kg: 61.235, reps: 4, rpe: 9.5 },
        ],
      },
      {
        index: 1, title: 'Cable Crossover', notes: null, exercise_template_id: 'T-CROSS', superset_id: null,
        sets: [{ index: 0, type: 'normal', weight_kg: 15, reps: 12, rpe: null }],
      },
      {
        index: 2, title: 'Treadmill', notes: null, exercise_template_id: 'T-RUN', superset_id: null,
        sets: [{ index: 0, type: 'normal', weight_kg: null, reps: null, duration_seconds: 600, distance_meters: 1500 }],
      },
    ],
  },
  {
    id: 'w-pull',
    title: 'Pull Day',
    description: null,
    start_time: '2026-11-16T15:00:00Z',
    end_time: '2026-11-16T16:00:00Z',
    updated_at: '2026-11-16T16:01:00Z',
    exercises: [
      {
        index: 0, title: 'Assisted Pull Up', notes: '', exercise_template_id: 'T-APU',
        sets: [{ index: 0, type: 'normal', weight_kg: 22.6796, reps: 8, rpe: 8 }],
      },
    ],
  },
];

const templates = {
  'T-BENCH': { id: 'T-BENCH', title: 'Bench Press (Barbell)', type: 'weight_reps', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], equipment: 'barbell' },
  'T-CROSS': { id: 'T-CROSS', title: 'Cable Crossover', type: 'weight_reps', primary_muscle_group: 'chest', secondary_muscle_groups: [], equipment: 'machine' },
  'T-RUN': { id: 'T-RUN', title: 'Treadmill', type: 'distance_duration', primary_muscle_group: 'cardio', secondary_muscle_groups: [], equipment: 'none' },
  'T-APU': { id: 'T-APU', title: 'Assisted Pull Up', type: 'bodyweight_assisted_reps', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps'], equipment: 'machine' },
};

let hevyRequests = [];

// Hevy body measurements by date. POST fails with 409 when the date exists;
// PUT replaces the whole entry (fields left out become null), like Hevy.
const bodyMeasurements = new Map();
const MEASUREMENT_KEYS = ['weight_kg', 'lean_mass_kg', 'fat_percent', 'neck_cm', 'shoulder_cm', 'chest_cm',
  'left_bicep_cm', 'right_bicep_cm', 'left_forearm_cm', 'right_forearm_cm', 'abdomen', 'waist', 'hips',
  'left_thigh', 'right_thigh', 'left_calf', 'right_calf'];
// Make the next request whose "METHOD path" matches fail with this status
const hevyFaults = [];

function startFakeHevy() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    hevyRequests.push(url.pathname + url.search);
    const send = (status, body) => {
      res.writeHead(status, body === undefined ? {} : { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (req.headers['api-key'] !== VALID_KEY) return send(401, { error: 'Unauthorized' });

    const fault = hevyFaults.findIndex((f) => f.match.test(`${req.method} ${url.pathname}`));
    if (fault >= 0) {
      const f = hevyFaults.splice(fault, 1)[0];
      if (f.delayMs) await new Promise((r) => setTimeout(r, f.delayMs)); // slow Hevy, then carry on
      else return send(f.status, { error: 'fault' });
    }

    let body = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try { body = JSON.parse(raw); } catch { return send(400, { error: 'Invalid JSON' }); }
    }

    if (url.pathname === '/v1/body_measurements' && req.method === 'POST') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body?.date || '')) return send(400, { error: 'date is required' });
      if (bodyMeasurements.has(body.date)) return send(409, { error: 'A measurement for this date already exists' });
      const entry = { date: body.date };
      for (const k of MEASUREMENT_KEYS) entry[k] = body[k] ?? null;
      bodyMeasurements.set(body.date, entry);
      return send(201);
    }
    let bm = url.pathname.match(/^\/v1\/body_measurements\/(\d{4}-\d{2}-\d{2})$/);
    if (bm && req.method === 'GET') {
      const entry = bodyMeasurements.get(bm[1]);
      return entry ? send(200, entry) : send(404, { error: 'Body measurement not found' });
    }
    if (bm && req.method === 'PUT') {
      if (!bodyMeasurements.has(bm[1])) return send(404, { error: 'No measurement found for the given date' });
      if ('date' in body) return send(400, { error: 'date is not allowed' });
      const entry = { date: bm[1] };
      for (const k of MEASUREMENT_KEYS) entry[k] = body[k] ?? null;
      bodyMeasurements.set(bm[1], entry);
      return send(200);
    }

    if (url.pathname === '/v1/user/info') return send(200, { data: { id: 'u1', username: 'lifter', weight_unit: 'lbs' } });
    if (url.pathname === '/v1/workouts') {
      const page = Number(url.searchParams.get('page') || 1);
      const size = Number(url.searchParams.get('pageSize') || 10);
      if (size > 10) return send(400, { error: 'pageSize too large' });
      return send(200, { page, page_count: Math.ceil(hevyWorkouts.length / size), workouts: hevyWorkouts.slice((page - 1) * size, page * size) });
    }
    if (url.pathname === '/v1/workouts/events') {
      const since = Date.parse(url.searchParams.get('since'));
      const events = hevyWorkouts.filter((w) => Date.parse(w.updated_at) > since).map((workout) => ({ type: 'updated', workout }));
      events.push({ type: 'deleted', id: 'w-gone', deleted_at: new Date().toISOString() });
      return send(200, { page: 1, page_count: 1, events });
    }
    let m = url.pathname.match(/^\/v1\/workouts\/([^/]+)$/);
    if (m) {
      const workout = hevyWorkouts.find((w) => w.id === decodeURIComponent(m[1]));
      return workout ? send(200, workout) : send(404, { error: 'Not found' });
    }
    m = url.pathname.match(/^\/v1\/exercise_templates\/([^/]+)$/);
    if (m) {
      const template = templates[decodeURIComponent(m[1])];
      return template ? send(200, template) : send(404, { error: 'Not found' });
    }
    return send(404, { error: 'Not found' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------
// App server
// ---------------------------------------------------------------------------

async function startApp(hevyUrl, dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
      JWT_SECRET: Buffer.from('test-secret-for-hevy-tests').toString('base64'),
      HEVY_API_BASE_URL: hevyUrl,
      NODE_ENV: 'test',
      HEVY_AUTO_SYNC_WAIT_MS: '400',
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

// ---------------------------------------------------------------------------

async function unitTests() {
  console.log('\nConversion helpers');

  await test('normalizes names so spelling variants match', () => {
    assert.equal(normalizeExerciseName('Pull Up'), normalizeExerciseName('Pull-up'));
    assert.equal(normalizeExerciseName('Triceps Pushdown'), normalizeExerciseName('Tricep Pushdown'));
  });

  await test('suggests built-in exercises for common Hevy names', () => {
    const match = createExerciseMatcher([
      { id: 1, name: 'Barbell Bench Press' }, { id: 2, name: 'Barbell Squat' }, { id: 3, name: 'Pull-up' },
      { id: 4, name: 'Barbell Row' }, { id: 5, name: 'Lat Pulldown' }, { id: 6, name: 'Romanian Deadlift' },
    ]);
    assert.equal(match('Bench Press (Barbell)')?.id, 1);
    assert.equal(match('Squat (Barbell)')?.id, 2);
    assert.equal(match('Pull Up')?.id, 3);
    assert.equal(match('Bent Over Row (Barbell)')?.id, 4);
    assert.equal(match('Lat Pulldown (Cable)')?.id, 5);
    assert.equal(match('Romanian Deadlift (Barbell)')?.id, 6);
    assert.equal(match('Squat (Dumbbell)'), null);
    assert.equal(match('Cable Crossover'), null);
  });

  await test('converts kg to the user\'s units without float noise', () => {
    assert.equal(convertWeight(61.235, 'lbs'), 135);
    assert.equal(convertWeight(20.4117, 'lbs'), 45);
    assert.equal(convertWeight(102.5, 'kg'), 102.5);
    assert.equal(convertWeight(null, 'lbs'), 0);
  });

  await test('dates a workout in the user\'s timezone', () => {
    assert.equal(localDate('2026-11-19T02:00:00Z', 'America/New_York'), '2026-11-18');
    assert.equal(localDate('2026-11-19T02:00:00Z', 'UTC'), '2026-11-19');
    assert.equal(localDate('2026-11-19T02:00:00Z', 'Not/AZone'), '2026-11-19');
  });

  await test('converts sets: warmups, RPE only when logged, notes, assisted weights', () => {
    const exercises = { 'T-BENCH': { id: 10, name: 'Barbell Bench Press' }, 'T-RUN': { id: 11, name: 'Treadmill' } };
    const out = convertHevyWorkout(hevyWorkouts[0], {
      exerciseFor: (id) => exercises[id] ?? null, units: 'lbs', timeZone: 'America/New_York',
    });
    assert.deepEqual(out.workout, { date: '2026-11-18', name: 'Push Day', notes: 'Felt strong', duration_minutes: 75 });
    assert.deepEqual(out.skipped_exercises, ['Cable Crossover']);
    assert.equal(out.sets.length, 4);
    assert.deepEqual(out.sets[0], { exercise_id: 10, set_number: 1, reps: 10, weight: 45, rpe: null, is_warmup: true, notes: 'Paused reps' });
    assert.equal(out.sets[1].rpe, null);
    assert.equal(out.sets[2].rpe, 9.5);
    assert.equal(out.sets[2].notes, 'To failure');
    assert.deepEqual(out.sets[3], { exercise_id: 11, set_number: 1, reps: 0, weight: 0, rpe: null, is_warmup: false, notes: 'Duration 10:00 · Distance 1500 m' });

    const assisted = convertHevyWorkout(hevyWorkouts[1], {
      exerciseFor: () => ({ id: 12, name: 'Machine-Assisted Pull-up' }), units: 'lbs', timeZone: 'UTC',
    });
    assert.equal(assisted.sets[0].weight, -50);
  });

  await test('suggests fields for a new exercise from a Hevy template', () => {
    assert.deepEqual(newExerciseFromTemplate('Bench Press (Barbell)', templates['T-BENCH']), {
      name: 'Bench Press (Barbell)', category: 'barbell', primary_muscle_group: 'Chest',
      secondary_muscle_groups: ['Triceps', 'Shoulders'], is_compound: 1,
    });
    assert.equal(newExerciseFromTemplate('Treadmill', templates['T-RUN']).primary_muscle_group, 'Other');
    assert.equal(newExerciseFromTemplate('Treadmill', templates['T-RUN']).category, 'bodyweight');
  });
}

async function weightUnitTests() {
  console.log('\nBodyweight -> Hevy');

  await test('converts bodyweight to kg', () => {
    assert.equal(toKg(180, 'lbs'), 81.647);
    assert.equal(toKg(80.5, 'kg'), 80.5);
  });

  await test('merging keeps the other measurements and only changes the weight', () => {
    const merged = mergeWeight({ date: '2026-11-01', weight_kg: 80, fat_percent: 18, waist: 82, id: 'x' }, 81.2);
    assert.equal(merged.weight_kg, 81.2);
    assert.equal(merged.fat_percent, 18);
    assert.equal(merged.waist, 82);
    assert.equal(merged.chest_cm, null);
    assert.ok(!('date' in merged) && !('id' in merged), 'only fields PUT accepts');
  });

  // A stub client that plays back a scripted sequence of Hevy responses
  const scripted = (script) => {
    const calls = [];
    const step = (name, ...args) => {
      calls.push(name);
      const next = script.shift();
      if (!next || next[0] !== name) throw new Error(`unexpected ${name}, script had ${next?.[0]}`);
      if (next[1] instanceof Error) throw next[1];
      return next[1];
    };
    return {
      calls,
      createBodyMeasurement: async (m) => step('create', m),
      getBodyMeasurement: async (d) => step('get', d),
      updateBodyMeasurement: async (d, f) => step('update', d, f),
    };
  };
  const conflict = () => new HevyApiError('exists', 409);
  const notFound = () => new HevyApiError('missing', 404);

  await test('creates when the date is free', async () => {
    const c = scripted([['create']]);
    assert.equal(await pushBodyweight(c, '2026-11-01', 80), 'created');
  });

  await test('409: updates the existing entry', async () => {
    const c = scripted([['create', conflict()], ['get', { date: '2026-11-01', weight_kg: 79, fat_percent: 17 }], ['update']]);
    assert.equal(await pushBodyweight(c, '2026-11-01', 80), 'updated');
  });

  await test('409 with the same weight already there: no write', async () => {
    const c = scripted([['create', conflict()], ['get', { date: '2026-11-01', weight_kg: 80.0001 }]]);
    assert.equal(await pushBodyweight(c, '2026-11-01', 80), 'unchanged');
    assert.deepEqual(c.calls, ['create', 'get']);
  });

  await test('409, then the entry is deleted before we read it: creates again', async () => {
    const c = scripted([['create', conflict()], ['get', null], ['create']]);
    assert.equal(await pushBodyweight(c, '2026-11-01', 80), 'created');
  });

  await test('409, then the entry is deleted before we update it: creates again', async () => {
    const c = scripted([['create', conflict()], ['get', { weight_kg: 70 }], ['update', notFound()], ['create']]);
    assert.equal(await pushBodyweight(c, '2026-11-01', 80), 'created');
  });

  await test('gives up with a 409 error if Hevy keeps flipping', async () => {
    const script = [];
    for (let i = 0; i < 3; i++) script.push(['create', conflict()], ['get', null]);
    await assert.rejects(pushBodyweight(scripted(script), '2026-11-01', 80), (e) => e.status === 409);
  });

  await test('other errors are passed on', async () => {
    const c = scripted([['create', new HevyApiError('bad', 400)]]);
    await assert.rejects(pushBodyweight(c, '2026-11-01', 80), (e) => e.status === 400);
  });
}

async function apiTests() {
  console.log('\n/api/hevy routes (fake Hevy server)');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hevy-test-'));
  const fakeHevy = await startFakeHevy();
  const app = await startApp(`http://127.0.0.1:${fakeHevy.address().port}`, path.join(tmp, 'test.db'));

  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'hevy@test.local', password: 'secret123', username: 'tester', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);

    await test('starts disconnected and refuses to list workouts', async () => {
      assert.deepEqual((await call('GET', '/hevy/status')).body, { connected: false });
      const r = await call('GET', '/hevy/workouts');
      assert.equal(r.status, 400);
      assert.equal(r.body.code, 'hevy_not_connected');
    });

    await test('rejects a key Hevy refuses, without saving it', async () => {
      const r = await call('PUT', '/hevy/connection', { api_key: 'wrong-key-123456' });
      assert.equal(r.status, 400);
      assert.equal(r.body.code, 'hevy_key_rejected');
      assert.equal((await call('GET', '/hevy/status')).body.connected, false);
    });

    await test('saves a working key, encrypted, and only exposes its last 4 characters', async () => {
      const r = await call('PUT', '/hevy/connection', { api_key: VALID_KEY });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.connected, true);
      assert.equal(r.body.key_hint, '1234');
      assert.equal(r.body.hevy_username, 'lifter');
      assert.ok(!JSON.stringify(r.body).includes(VALID_KEY));
      assert.ok(!JSON.stringify((await call('GET', '/profile')).body).includes(VALID_KEY));
      // Wait for the server to write the database, then check the key isn't in it in plain text
      await new Promise((res) => setTimeout(res, 100));
      assert.ok(!fs.readFileSync(path.join(tmp, 'test.db')).includes(VALID_KEY));
    });

    await test('lists Hevy workouts, all new, using Hevy\'s maximum page size', async () => {
      hevyRequests = [];
      const r = await call('GET', '/hevy/workouts?page=1');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.mode, 'all');
      assert.deepEqual(r.body.workouts.map((w) => [w.id, w.status]), [['w-push', 'new'], ['w-pull', 'new']]);
      assert.equal(r.body.workouts[0].set_count, 5);
      assert.ok(hevyRequests.includes('/v1/workouts?page=1&pageSize=10'), hevyRequests.join(', '));
    });

    let preview;
    await test('preview lists each exercise once with a suggestion where one exists', async () => {
      const r = await call('POST', '/hevy/preview', { workout_ids: ['w-push', 'w-pull', 'w-missing'] });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      preview = r.body;
      assert.deepEqual(preview.missing, ['w-missing']);
      const byId = Object.fromEntries(preview.exercises.map((e) => [e.template_id, e]));
      assert.deepEqual(Object.keys(byId), ['T-BENCH', 'T-CROSS', 'T-RUN', 'T-APU']);
      assert.equal(byId['T-BENCH'].suggestion.exercise_name, 'Barbell Bench Press');
      assert.equal(byId['T-BENCH'].suggestion.source, 'name_match');
      assert.equal(byId['T-CROSS'].suggestion, null);
      assert.equal(byId['T-CROSS'].new_exercise.primary_muscle_group, 'Chest');
      assert.equal(byId['T-APU'].suggestion.exercise_name, 'Machine-Assisted Pull-up');
    });

    await test('import refuses when an exercise has no choice', async () => {
      const r = await call('POST', '/hevy/import', { workout_ids: ['w-push'], exercises: {} });
      assert.equal(r.status, 400);
      assert.match(r.body.error, /Bench Press/);
    });

    let pushWorkoutId;
    await test('imports chosen workouts: matched, new and skipped exercises', async () => {
      const byId = Object.fromEntries(preview.exercises.map((e) => [e.template_id, e]));
      const r = await call('POST', '/hevy/import', {
        workout_ids: ['w-push'],
        timezone: 'America/New_York',
        exercises: {
          'T-BENCH': { exercise_id: byId['T-BENCH'].suggestion.exercise_id },
          'T-CROSS': { create: byId['T-CROSS'].new_exercise },
          'T-RUN': { skip: true },
        },
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.imported.length, 1);
      assert.equal(r.body.imported[0].action, 'created');
      assert.deepEqual(r.body.imported[0].skipped_exercises, ['Treadmill']);
      assert.deepEqual(r.body.created_exercises.map((e) => e.name), ['Cable Crossover']);
      assert.ok(r.body.status.last_synced_at);
      pushWorkoutId = r.body.imported[0].workout_id;

      const w = (await call('GET', `/workouts/${pushWorkoutId}`)).body.workout;
      assert.equal(w.date, '2026-11-18');
      assert.equal(w.name, 'Push Day');
      assert.equal(w.duration_minutes, 75);
      assert.deepEqual(w.sets.map((s) => [s.exercise_name, s.set_number, s.weight, s.reps, s.rpe, s.is_warmup]), [
        ['Barbell Bench Press', 1, 45, 10, null, 1],
        ['Barbell Bench Press', 2, 135, 5, null, 0],
        ['Barbell Bench Press', 3, 135, 4, 9.5, 0],
        ['Cable Crossover', 1, 33.1, 12, null, 0],
      ]);
    });

    await test('latest workout: the newest one, asking Hevy for a single workout', async () => {
      hevyRequests = [];
      const r = await call('GET', '/hevy/workouts/latest');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.workout.id, 'w-push');
      assert.equal(r.body.workout.status, 'imported');
      assert.equal(r.body.workout.local_workout_id, pushWorkoutId);
      assert.deepEqual(hevyRequests, ['/v1/workouts?page=1&pageSize=1']);
    });

    await test('marks imported workouts and remembers exercise choices', async () => {
      const list = (await call('GET', '/hevy/workouts')).body.workouts;
      assert.deepEqual(list.map((w) => [w.id, w.status, w.local_workout_id]), [['w-push', 'imported', pushWorkoutId], ['w-pull', 'new', null]]);
      const again = (await call('POST', '/hevy/preview', { workout_ids: ['w-push'] })).body;
      const cross = again.exercises.find((e) => e.template_id === 'T-CROSS');
      assert.equal(cross.suggestion.source, 'saved');
      assert.equal(cross.suggestion.exercise_name, 'Cable Crossover');
      // Skipped exercises aren't remembered
      assert.equal(again.exercises.find((e) => e.template_id === 'T-RUN').suggestion, null);
    });

    await test('"new since last import" shows only workouts changed in Hevy since then', async () => {
      let r = await call('GET', '/hevy/workouts?mode=new');
      assert.equal(r.body.mode, 'new');
      assert.deepEqual(r.body.workouts, []);

      hevyWorkouts[0].updated_at = new Date(Date.now() + 60000).toISOString();
      hevyWorkouts[0].exercises[0].sets[1].reps = 6;
      r = await call('GET', '/hevy/workouts?mode=new');
      assert.deepEqual(r.body.workouts.map((w) => [w.id, w.status]), [['w-push', 'changed']]);
    });

    await test('re-importing a changed workout updates it instead of duplicating', async () => {
      const r = await call('POST', '/hevy/import', {
        workout_ids: ['w-push'],
        timezone: 'America/New_York',
        exercises: { 'T-BENCH': { exercise_id: preview.exercises[0].suggestion.exercise_id }, 'T-CROSS': { create: { name: 'Cable Crossover', category: 'cable', primary_muscle_group: 'Chest' } }, 'T-RUN': { skip: true } },
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.imported[0].action, 'updated');
      assert.equal(r.body.imported[0].workout_id, pushWorkoutId);
      assert.deepEqual(r.body.created_exercises, [], 'reuses the existing "Cable Crossover" exercise');
      const all = (await call('GET', '/workouts')).body.workouts;
      assert.equal(all.length, 1);
      const sets = (await call('GET', `/workouts/${pushWorkoutId}`)).body.workout.sets;
      assert.equal(sets[1].reps, 6);
    });

    await test('assisted exercises are stored as negative weight', async () => {
      const apu = preview.exercises.find((e) => e.template_id === 'T-APU');
      const r = await call('POST', '/hevy/import', {
        workout_ids: ['w-pull'], timezone: 'UTC', exercises: { 'T-APU': { exercise_id: apu.suggestion.exercise_id } },
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const sets = (await call('GET', `/workouts/${r.body.imported[0].workout_id}`)).body.workout.sets;
      assert.equal(sets[0].weight, -50);
      assert.equal(sets[0].rpe, 8);
    });

    await test('a workout with every exercise skipped is reported, not imported', async () => {
      const r = await call('POST', '/hevy/import', {
        workout_ids: ['w-pull'], exercises: { 'T-APU': { skip: true } },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.imported.length, 0);
      assert.equal(r.body.skipped[0].reason, 'Every exercise in it was skipped');
    });

    const logWeight = async (weight, date, units = 'lbs') => {
      const r = await call('POST', '/profile/bodyweight', { weight, date, units });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    // New entries go to Hevy automatically while connected. The manual-sync
    // tests set up their entries while disconnected so they start unsent.
    const offline = async (fn) => {
      await call('DELETE', '/hevy/connection');
      try { return await fn(); } finally {
        const r = await call('PUT', '/hevy/connection', { api_key: VALID_KEY });
        assert.equal(r.status, 200, JSON.stringify(r.body));
      }
    };

    await test('weight status lists each date once, using its latest entry', async () => {
      await offline(async () => {
        assert.deepEqual((await logWeight(181, '2026-11-01')).hevy_sync, { status: 'not_connected' });
        await logWeight(180, '2026-11-01'); // later entry, same day: this one counts
        await logWeight(182, '2026-11-02');
        await logWeight(183, '2026-11-03');
      });
      const r = await call('GET', '/hevy/weight');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.entries.map((e) => [e.date, e.weight, e.status]), [
        ['2026-11-03', 183, 'not_synced'], ['2026-11-02', 182, 'not_synced'], ['2026-11-01', 180, 'not_synced'],
      ]);
      assert.equal(r.body.pending_count, 3);
    });

    await test('sync: creates new dates; on 409 updates the weight and keeps other measurements', async () => {
      // Logged in the Hevy app already: a different weight plus body fat and waist
      bodyMeasurements.set('2026-11-02', { date: '2026-11-02', weight_kg: 83, fat_percent: 18.5, waist: 84 });
      // And the same weight as here
      bodyMeasurements.set('2026-11-03', { date: '2026-11-03', weight_kg: toKg(183, 'lbs'), fat_percent: 18 });
      hevyRequests = [];

      const r = await call('POST', '/hevy/weight/sync', {});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.results.map((x) => [x.date, x.outcome]), [
        ['2026-11-03', 'unchanged'], ['2026-11-02', 'updated'], ['2026-11-01', 'created'],
      ]);
      assert.equal(r.body.remaining_count, 0);
      assert.ok(r.body.entries.every((e) => e.status === 'synced'));

      assert.equal(bodyMeasurements.get('2026-11-01').weight_kg, toKg(180, 'lbs'));
      const updated = bodyMeasurements.get('2026-11-02');
      assert.equal(updated.weight_kg, toKg(182, 'lbs'));
      assert.equal(updated.fat_percent, 18.5, 'body fat kept');
      assert.equal(updated.waist, 84, 'waist kept');
      assert.equal(bodyMeasurements.get('2026-11-03').fat_percent, 18);
      // The date that already had this weight was only read (GET), never written (PUT)
      assert.equal(hevyRequests.filter((p) => p === '/v1/body_measurements/2026-11-03').length, 1);
    });

    await test('editing an entry here marks it changed; syncing again updates Hevy', async () => {
      const log = (await call('GET', '/profile/bodyweight')).body.bodyweightLogs.find((l) => l.date === '2026-11-03');
      await offline(async () => {
        const u = await call('PUT', `/profile/bodyweight/${log.id}`, { weight: 184 });
        assert.equal(u.status, 200, JSON.stringify(u.body));
      });
      let r = await call('GET', '/hevy/weight');
      assert.equal(r.body.entries.find((e) => e.date === '2026-11-03').status, 'changed');
      assert.equal(r.body.pending_count, 1);

      r = await call('POST', '/hevy/weight/sync', {});
      assert.deepEqual(r.body.results.map((x) => [x.date, x.outcome]), [['2026-11-03', 'updated']]);
      assert.equal(bodyMeasurements.get('2026-11-03').weight_kg, toKg(184, 'lbs'));
      assert.equal(bodyMeasurements.get('2026-11-03').fat_percent, 18);
    });

    await test('syncing chosen dates resends them even when already synced', async () => {
      bodyMeasurements.get('2026-11-01').weight_kg = 50; // changed in the Hevy app since
      const r = await call('POST', '/hevy/weight/sync', { dates: ['2026-11-01'] });
      assert.deepEqual(r.body.results.map((x) => [x.date, x.outcome]), [['2026-11-01', 'updated']]);
      assert.equal(bodyMeasurements.get('2026-11-01').weight_kg, toKg(180, 'lbs'));
    });

    await test('rate limiting stops the batch and leaves the rest pending', async () => {
      await offline(async () => {
        await logWeight(185, '2026-11-04');
        await logWeight(186, '2026-11-05');
      });
      hevyFaults.push({ match: /^POST \/v1\/body_measurements$/, status: 429 });
      let r = await call('POST', '/hevy/weight/sync', {});
      assert.equal(r.status, 200);
      assert.equal(r.body.failed, 1);
      assert.match(r.body.stopped, /rate limiting/);
      assert.equal(r.body.results.length, 1, 'stopped after the first failure');
      assert.equal(r.body.remaining_count, 2);

      r = await call('POST', '/hevy/weight/sync', {});
      assert.equal(r.body.created, 2);
      assert.equal(r.body.remaining_count, 0);
    });

    await test('a failed date is reported and stays pending', async () => {
      await offline(() => logWeight(187, '2026-11-06'));
      hevyFaults.push({ match: /^POST \/v1\/body_measurements$/, status: 500 });
      const r = await call('POST', '/hevy/weight/sync', {});
      assert.deepEqual(r.body.results.map((x) => [x.date, x.outcome]), [['2026-11-06', 'failed']]);
      assert.equal(r.body.entries.find((e) => e.date === '2026-11-06').status, 'not_synced');
    });

    // Automatic sending of new weigh-ins
    const hevyWeight = async (date) => (await call('GET', '/hevy/weight')).body.entries.find((e) => e.date === date);

    await test('auto: a new weigh-in is sent to Hevy straight away', async () => {
      const r = await logWeight(188, '2026-11-10');
      assert.deepEqual(r.hevy_sync, { status: 'done', results: [{ date: '2026-11-10', outcome: 'created' }] });
      assert.equal(bodyMeasurements.get('2026-11-10').weight_kg, toKg(188, 'lbs'));
      assert.equal((await hevyWeight('2026-11-10')).status, 'synced');
    });

    await test('auto: Hevy already has that day (409): weight updated, other measurements kept', async () => {
      bodyMeasurements.set('2026-11-11', { date: '2026-11-11', weight_kg: 90, fat_percent: 19, hips: 100 });
      const r = await logWeight(189, '2026-11-11');
      assert.equal(r.hevy_sync.results[0].outcome, 'updated');
      const entry = bodyMeasurements.get('2026-11-11');
      assert.equal(entry.weight_kg, toKg(189, 'lbs'));
      assert.equal(entry.fat_percent, 19);
      assert.equal(entry.hips, 100);
    });

    await test('auto: a second weigh-in the same day replaces the first in Hevy', async () => {
      const r = await logWeight(187.5, '2026-11-10');
      assert.equal(r.hevy_sync.results[0].outcome, 'updated');
      assert.equal(bodyMeasurements.get('2026-11-10').weight_kg, toKg(187.5, 'lbs'));
    });

    await test('auto: editing an entry sends the new weight; moving it sends both dates', async () => {
      const logs = (await call('GET', '/profile/bodyweight')).body.bodyweightLogs;
      const log = logs.find((l) => l.date === '2026-11-11');
      let r = await call('PUT', `/profile/bodyweight/${log.id}`, { weight: 190 });
      assert.equal(r.body.hevy_sync.results[0].outcome, 'updated');
      assert.equal(bodyMeasurements.get('2026-11-11').weight_kg, toKg(190, 'lbs'));
      assert.equal(bodyMeasurements.get('2026-11-11').fat_percent, 19);

      // Move the 187.5 entry from the 10th to the 12th: the 10th falls back to 188
      const later = logs.filter((l) => l.date === '2026-11-10').sort((a, b) => b.id - a.id)[0];
      r = await call('PUT', `/profile/bodyweight/${later.id}`, { date: '2026-11-12' });
      assert.deepEqual(r.body.hevy_sync.results.map((x) => [x.date, x.outcome]), [['2026-11-12', 'created'], ['2026-11-10', 'updated']]);
      assert.equal(bodyMeasurements.get('2026-11-12').weight_kg, toKg(187.5, 'lbs'));
      assert.equal(bodyMeasurements.get('2026-11-10').weight_kg, toKg(188, 'lbs'));
    });

    await test('auto: deleting the latest entry of a day sends the one left', async () => {
      const a = (await logWeight(191, '2026-11-13')).bodyweight;
      const b = (await logWeight(192, '2026-11-13')).bodyweight;
      let r = await call('DELETE', `/profile/bodyweight/${b.id}`);
      assert.equal(r.body.hevy_sync.results[0].outcome, 'updated');
      assert.equal(bodyMeasurements.get('2026-11-13').weight_kg, toKg(191, 'lbs'));
      // Deleting the day's only entry: nothing to send (Hevy's API can't delete)
      r = await call('DELETE', `/profile/bodyweight/${a.id}`);
      assert.deepEqual(r.body.hevy_sync.results, [{ date: '2026-11-13', outcome: 'no_entry' }]);
    });

    await test('auto: Hevy failing still saves the weigh-in; it stays pending for the button', async () => {
      hevyFaults.push({ match: /^POST \/v1\/body_measurements$/, status: 500 });
      const r = await logWeight(193, '2026-11-14');
      assert.equal(r.hevy_sync.results[0].outcome, 'failed');
      assert.equal((await hevyWeight('2026-11-14')).status, 'not_synced');
      const s = await call('POST', '/hevy/weight/sync', { dates: ['2026-11-14'] });
      assert.equal(s.body.results[0].outcome, 'created');
    });

    await test('auto: slow Hevy doesn\'t hold up the weigh-in; the send finishes in the background', async () => {
      hevyFaults.push({ match: /^POST \/v1\/body_measurements$/, delayMs: 1000 });
      const started = Date.now();
      const r = await logWeight(194, '2026-11-15');
      assert.ok(Date.now() - started < 900, `answered in ${Date.now() - started} ms`);
      assert.deepEqual(r.hevy_sync, { status: 'pending' });
      await new Promise((res) => setTimeout(res, 1000));
      assert.equal(bodyMeasurements.get('2026-11-15').weight_kg, toKg(194, 'lbs'));
      assert.equal((await hevyWeight('2026-11-15')).status, 'synced');
    });

    await test('disconnecting forgets the key', async () => {
      assert.equal((await call('DELETE', '/hevy/connection')).body.connected, false);
      assert.equal((await call('GET', '/hevy/workouts')).body.code, 'hevy_not_connected');
      assert.equal((await call('GET', '/hevy/workouts/latest')).body.code, 'hevy_not_connected');
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fakeHevy.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await weightUnitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll Hevy tests passed');
process.exit(failures ? 1 : 0);
