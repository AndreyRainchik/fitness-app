#!/usr/bin/env node
/**
 * Strava sync tests: conversion and matching helpers, then connecting,
 * syncing and webhooks end to end against a fake Strava server. Uses a
 * throwaway database; no real Strava account needed.
 *
 *   npm run test:strava
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  cardioFields, classifyActivity, findCardioDuplicate, matchStrengthWorkout,
} from './services/stravaImport.js';

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
// Unit tests
// ---------------------------------------------------------------------------

async function unitTests() {
  console.log('\nConversion and matching helpers');

  await test('classifies sport and indoor/outdoor', () => {
    assert.deepEqual(classifyActivity({ sport_type: 'Run', start_latlng: [40.7, -74] }), { kind: 'cardio', sport: 'run', environment: 'outdoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'Run', start_latlng: [] }), { kind: 'cardio', sport: 'run', environment: 'indoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'Run', trainer: true, start_latlng: [1, 2] }), { kind: 'cardio', sport: 'run', environment: 'indoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'VirtualRide' }), { kind: 'cardio', sport: 'ride', environment: 'indoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'GravelRide', map: { summary_polyline: 'abc' } }), { kind: 'cardio', sport: 'ride', environment: 'outdoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'Rowing' }), { kind: 'cardio', sport: 'row', environment: 'indoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'RockClimbing', start_latlng: [1, 2] }), { kind: 'cardio', sport: 'boulder', environment: 'indoor' });
    assert.deepEqual(classifyActivity({ sport_type: 'WeightTraining' }), { kind: 'strength' });
    assert.deepEqual(classifyActivity({ type: 'Hike', start_latlng: [1, 2] }), { kind: 'cardio', sport: 'other', environment: 'outdoor' });
  });

  await test('converts a detailed run', () => {
    const fields = cardioFields({
      resource_state: 3, name: ' Morning Run ', description: 'Felt easy', start_date: '2026-11-17T12:05:00Z',
      start_date_local: '2026-11-17T07:05:00Z', moving_time: 2700, elapsed_time: 2800, distance: 8046.72,
      total_elevation_gain: 41.6, average_cadence: 85.6, has_heartrate: true, average_heartrate: 147.6, max_heartrate: 171,
      calories: 612.4, map: { summary_polyline: 'poly' },
      splits_metric: [{ distance: 1000, moving_time: 330, elevation_difference: 2.04, average_heartrate: 140.2 }],
    }, { sport: 'run', environment: 'outdoor' });
    assert.equal(fields.date, '2026-11-17'); // local date, not UTC
    assert.equal(fields.start_time, '2026-11-17T12:05:00.000Z');
    assert.equal(fields.name, 'Morning Run');
    assert.equal(fields.notes, 'Felt easy');
    assert.equal(fields.duration_s, 2700);
    assert.equal(fields.distance_m, 8046.7);
    assert.equal(fields.elevation_gain_m, 42);
    assert.equal(fields.avg_cadence, 171); // per leg -> steps per minute
    assert.equal(fields.avg_hr, 148);
    assert.equal(fields.calories, 612);
    assert.equal(fields.summary_polyline, 'poly');
    assert.deepEqual(JSON.parse(fields.splits_json).metric, [{ distance: 1000, moving_time: 330, elevation_difference: 2, average_heartrate: 140 }]);
  });

  await test('summary activities leave notes and splits alone', () => {
    const fields = cardioFields({ name: 'Climb', start_date: '2026-11-18T23:00:00Z', start_date_local: '2026-11-18T18:00:00Z', moving_time: 0, elapsed_time: 5400, distance: 0, has_heartrate: false, average_heartrate: 120 }, { sport: 'boulder', environment: 'indoor' });
    assert.equal(fields.notes, undefined);
    assert.equal(fields.splits_json, undefined);
    assert.equal(fields.duration_s, 5400); // elapsed when there's no moving time
    assert.equal(fields.distance_m, null);
    assert.equal(fields.avg_hr, null);
  });

  await test('matches a lifting session to the right workout', () => {
    const activity = { start_date: '2026-11-19T23:00:00Z', start_date_local: '2026-11-19T18:00:00Z', elapsed_s: 4200 };
    const timed = { id: 1, date: '2026-11-19', start_time: '2026-11-19T23:10:00Z', duration_minutes: 70 };
    const untimed = { id: 2, date: '2026-11-19', start_time: null, duration_minutes: 70 };
    const farOff = { id: 3, date: '2026-11-19', start_time: '2026-11-19T12:00:00Z', duration_minutes: 60 };
    assert.equal(matchStrengthWorkout(activity, [untimed, timed, farOff])?.id, 1);
    assert.equal(matchStrengthWorkout(activity, [untimed, farOff])?.id, 2);
    assert.equal(matchStrengthWorkout(activity, [farOff]), null);
    // Two untimed workouts that day: the one closest in length
    assert.equal(matchStrengthWorkout(activity, [{ ...untimed, id: 4, duration_minutes: 20 }, untimed])?.id, 2);
    assert.equal(matchStrengthWorkout(activity, [{ ...untimed, date: '2026-11-18' }]), null);
  });

  await test('finds a session logged by hand', () => {
    const fields = { sport: 'run', date: '2026-11-17', start_time: '2026-11-17T12:05:00Z', duration_s: 2700 };
    assert.equal(findCardioDuplicate(fields, [{ id: 1, sport: 'run', date: '2026-11-17', start_time: '2026-11-17T12:12:00Z', duration_s: 2000 }])?.id, 1);
    assert.equal(findCardioDuplicate(fields, [{ id: 1, sport: 'run', date: '2026-11-17', start_time: '2026-11-17T14:00:00Z', duration_s: 2700 }]), null);
    assert.equal(findCardioDuplicate(fields, [{ id: 2, sport: 'run', date: '2026-11-17', start_time: null, duration_s: 2800 }])?.id, 2);
    assert.equal(findCardioDuplicate(fields, [{ id: 2, sport: 'run', date: '2026-11-17', start_time: null, duration_s: 1800 }]), null);
    assert.equal(findCardioDuplicate(fields, [{ id: 3, sport: 'ride', date: '2026-11-17', start_time: '2026-11-17T12:05:00Z', duration_s: 2700 }]), null);
  });
}

// ---------------------------------------------------------------------------
// Fake Strava
// ---------------------------------------------------------------------------

const ATHLETE = { id: 98765, firstname: 'Alex', lastname: 'Runner' };
const DAY = 86400 * 1000;
const now = Date.now();
// A date a few days ago at a given UTC hour (the fake athlete lives in UTC)
const at = (daysAgo, hour) => {
  const d = new Date(now - daysAgo * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString().replace('.000Z', 'Z');
};
const dateOf = (iso) => iso.slice(0, 10);

function activity(id, sport_type, start, extra = {}) {
  return {
    id, resource_state: 2, sport_type, type: sport_type, name: `${sport_type} ${id}`, start_date: start, start_date_local: start,
    moving_time: 1800, elapsed_time: 1900, distance: 0, total_elevation_gain: 0, trainer: false, start_latlng: [],
    map: { summary_polyline: '' }, has_heartrate: true, average_heartrate: 140, max_heartrate: 165, ...extra,
  };
}

function initialActivities() {
  return [
    activity(1001, 'Run', at(4, 12), { name: 'Morning Run', distance: 8046.7, average_cadence: 86, start_latlng: [40.7, -74], map: { summary_polyline: '_p~iF~ps|U_ulLnnqC' }, total_elevation_gain: 30 }),
    activity(1002, 'Run', at(3, 22), { trainer: true, distance: 5000 }),
    activity(1003, 'VirtualRide', at(3, 12), { moving_time: 3600, distance: 30000 }),
    activity(1004, 'RockClimbing', at(2, 23), { moving_time: 0, elapsed_time: 5400, average_heartrate: 118 }),
    activity(1005, 'Rowing', at(2, 12), { moving_time: 1500, average_heartrate: 150 }),
    activity(1006, 'WeightTraining', at(1, 23), { elapsed_time: 4200, average_heartrate: 112, max_heartrate: 151 }),
    activity(1007, 'WeightTraining', at(0, 10), { elapsed_time: 3600, average_heartrate: 120, max_heartrate: 160 }),
    activity(9001, 'Run', at(400, 12), { distance: 10000, start_latlng: [40.7, -74] }), // old: comes from the history import
  ];
}

/**
 * Second-by-second data like Strava's: 1 Hz, steady pace with one faster
 * kilometre in the middle, heart rate climbing from 120 to 170. Climbing has
 * none (404), like an activity recorded without sensors.
 */
function streamsFor(a, keys) {
  if (a.sport_type === 'RockClimbing') return null;
  const n = Math.max(2, a.moving_time || a.elapsed_time);
  const time = Array.from({ length: n }, (_, i) => i);
  const base = a.distance > 0 ? a.distance / n : 0;
  const distance = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    distance.push(Math.round(d * 10) / 10);
    // From 40% of the way, run 25% faster for 1 km
    const fast = base > 0 && d >= a.distance * 0.4 && d < a.distance * 0.4 + 1000;
    d += fast ? base * 1.25 : base;
  }
  const all = {
    time, distance,
    heartrate: time.map((t) => Math.round(120 + (50 * t) / n)),
    velocity_smooth: time.map(() => base),
    altitude: time.map((t) => 10 + Math.sin(t / 60) * 5),
    cadence: time.map(() => 86),
    latlng: a.start_latlng?.length === 2 ? time.map((t) => [a.start_latlng[0] + t * 1e-5, a.start_latlng[1]]) : null,
  };
  const out = {};
  for (const key of keys) if (all[key]) out[key] = { data: all[key], series_type: 'time', original_size: n, resolution: 'high' };
  return out;
}

const DETAILS = {
  description: 'From the watch',
  calories: 500,
  splits_metric: [{ distance: 1000, moving_time: 300, elevation_difference: 1, average_heartrate: 140 }],
  splits_standard: [{ distance: 1609.3, moving_time: 480, elevation_difference: 2, average_heartrate: 141 }],
};

function startFakeStrava() {
  const state = {
    activities: initialActivities(),
    requests: [],
    tokenGrants: [],
    issuedTokens: [], // access tokens, in the order issued
    streamRequests: [], // activity ids whose streams were asked for
    expireNextToken: false,
    rateLimitAfter: null, // 429 every API request after this many more
  };
  let tokenCounter = 0;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const form = new URLSearchParams(raw);
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/oauth/token') {
      state.tokenGrants.push(form.get('grant_type'));
      if (form.get('client_id') !== 'test-client' || form.get('client_secret') !== 'test-secret') return send(401, { message: 'Bad client' });
      if (form.get('grant_type') === 'authorization_code' && form.get('code') !== 'good-code') return send(400, { message: 'Bad Request', errors: [{ code: 'invalid' }] });
      tokenCounter += 1;
      const expiresAt = state.expireNextToken ? Math.floor(Date.now() / 1000) - 10 : Math.floor(Date.now() / 1000) + 21600;
      state.expireNextToken = false;
      state.issuedTokens.push(`access-${tokenCounter}`);
      return send(200, {
        access_token: `access-${tokenCounter}`, refresh_token: `refresh-${tokenCounter}`, expires_at: expiresAt,
        ...(form.get('grant_type') === 'authorization_code' ? { athlete: ATHLETE } : {}),
      });
    }
    if (url.pathname === '/oauth/deauthorize') return send(200, { access_token: form.get('access_token') });

    const auth = req.headers.authorization || '';
    state.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), token: auth.replace('Bearer ', '') });
    if (!/^Bearer access-\d+$/.test(auth)) return send(401, { message: 'Authorization Error' });
    if (state.rateLimitAfter !== null) {
      if (state.rateLimitAfter <= 0) return send(429, { message: 'Rate Limit Exceeded' });
      state.rateLimitAfter -= 1;
    }

    if (url.pathname === '/api/v3/athlete/activities') {
      const after = Number(url.searchParams.get('after') || 0);
      const before = Number(url.searchParams.get('before') || Infinity);
      const perPage = Number(url.searchParams.get('per_page') || 30);
      const page = Number(url.searchParams.get('page') || 1);
      const epoch = (a) => Date.parse(a.start_date) / 1000;
      const list = state.activities
        .filter((a) => epoch(a) > after && epoch(a) < before)
        .sort((a, b) => (url.searchParams.has('after') ? epoch(a) - epoch(b) : epoch(b) - epoch(a)));
      return send(200, list.slice((page - 1) * perPage, page * perPage));
    }
    const streamsMatch = url.pathname.match(/^\/api\/v3\/activities\/(\d+)\/streams$/);
    if (streamsMatch) {
      state.streamRequests.push(Number(streamsMatch[1]));
      const a = state.activities.find((x) => x.id === Number(streamsMatch[1]));
      const streams = a && streamsFor(a, (url.searchParams.get('keys') || '').split(','));
      if (!streams) return send(404, { message: 'Record Not Found' });
      return send(200, streams);
    }
    const match = url.pathname.match(/^\/api\/v3\/activities\/(\d+)$/);
    if (match) {
      const a = state.activities.find((x) => x.id === Number(match[1]));
      if (!a) return send(404, { message: 'Record Not Found' });
      return send(200, { ...a, ...DETAILS, resource_state: 3 });
    }
    return send(404, { message: 'Not Found' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state })));
}

// ---------------------------------------------------------------------------
// App server
// ---------------------------------------------------------------------------

async function startApp(stravaUrl, dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
      JWT_SECRET: Buffer.from('test-secret-for-strava-tests').toString('base64'),
      NODE_ENV: 'test',
      STRAVA_CLIENT_ID: 'test-client',
      STRAVA_CLIENT_SECRET: 'test-secret',
      STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-me',
      STRAVA_API_BASE_URL: `${stravaUrl}/api/v3`,
      STRAVA_OAUTH_BASE_URL: `${stravaUrl}/oauth`,
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
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, what) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function apiTests() {
  console.log('\n/api/strava routes (fake Strava server)');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strava-test-'));
  const fake = await startFakeStrava();
  const stravaUrl = `http://127.0.0.1:${fake.server.address().port}`;
  const app = await startApp(stravaUrl, path.join(tmp, 'test.db'));

  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'strava@test.local', password: 'secret123', username: 'tester', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);
    const other = await anon('POST', '/auth/register', { email: 'other@test.local', password: 'secret123', username: 'other', units: 'kg' });
    const callOther = api(app.base, other.body.token);

    const workouts = async () => (await call('GET', '/workouts')).body.workouts;
    const byStrava = async () => {
      const list = await workouts();
      const details = await Promise.all(list.map((w) => call('GET', `/workouts/${w.id}`)));
      return details.map((d) => d.body.workout);
    };

    // Before connecting: a lifting session logged by hand (no start time) on
    // the day of WeightTraining 1006, and the morning run logged by hand
    const lift = await call('POST', '/workouts', { date: dateOf(at(1, 23)), name: 'Lower', duration_minutes: 70, sets: [{ exercise_id: 1, set_number: 1, reps: 5, weight: 225 }] });
    const handRun = await call('POST', '/cardio', { date: dateOf(at(4, 12)), start_time: '' + new Date(Date.parse(at(4, 12)) + 4 * 60000).toISOString(), sport: 'run', environment: 'outdoor', duration_s: 2650, name: 'My run', notes: 'Logged by hand' });
    assert.equal(handRun.status, 201, JSON.stringify(handRun.body));

    await test('starts disconnected and configured', async () => {
      const r = await call('GET', '/strava/status');
      assert.deepEqual(r.body, { configured: true, connected: false });
      assert.equal((await call('POST', '/strava/sync')).body.code, 'strava_not_connected');
    });

    let state;
    await test('builds the strava.com sign-in link', async () => {
      assert.equal((await call('POST', '/strava/authorize', { redirect_uri: 'https://evil.example/steal' })).status, 400);
      const r = await call('POST', '/strava/authorize', { redirect_uri: 'http://localhost:5173/strava/callback' });
      assert.equal(r.status, 200);
      const url = new URL(r.body.url);
      assert.equal(url.origin + url.pathname, `${stravaUrl}/oauth/authorize`);
      assert.equal(url.searchParams.get('client_id'), 'test-client');
      assert.equal(url.searchParams.get('scope'), 'read,activity:read_all');
      assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/strava/callback');
      state = url.searchParams.get('state');
    });

    await test('refuses a state from another user, a missing scope or a bad code', async () => {
      assert.equal((await callOther('POST', '/strava/exchange', { code: 'good-code', state, scope: 'read,activity:read_all' })).status, 400);
      const noScope = await call('POST', '/strava/exchange', { code: 'good-code', state, scope: 'read' });
      assert.equal(noScope.body.code, 'strava_scope_missing');
      const badCode = await call('POST', '/strava/exchange', { code: 'bad-code', state, scope: 'read,activity:read_all' });
      assert.equal(badCode.status, 502);
      assert.equal((await call('GET', '/strava/status')).body.connected, false);
    });

    await test('connects and imports in the background', async () => {
      const r = await call('POST', '/strava/exchange', { code: 'good-code', state, scope: 'read,activity:read_all' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.connected, true);
      assert.equal(r.body.athlete_name, 'Alex Runner');
      await waitFor(async () => (await call('GET', '/strava/status')).body.history_imported, 'the first sync');
      const status = (await call('GET', '/strava/status')).body;
      assert.deepEqual(status.counts, { cardio: 6, strength_linked: 1, strength_unmatched: 1, ignored: 0 });
    });

    await test('maps each activity to the right session', async () => {
      const all = await byStrava();
      const find = (id) => all.find((w) => w.strava?.activity_id === String(id));
      const run = find(1001);
      assert.equal(run.id, handRun.body.workout.id); // linked to the hand-logged run, not duplicated
      assert.equal(run.name, 'My run');
      assert.equal(run.notes, 'Logged by hand');
      assert.equal(run.cardio.distance_m, 8046.7);
      assert.equal(run.cardio.avg_cadence, 172);
      assert.equal(run.cardio.summary_polyline, '_p~iF~ps|U_ulLnnqC');
      assert.ok(JSON.parse(run.cardio.splits_json).standard.length);
      assert.equal(run.metrics.calories, 500);
      assert.equal(find(1002).cardio.environment, 'indoor');
      assert.equal(find(1003).cardio.sport, 'ride');
      assert.equal(find(1004).cardio.sport, 'boulder');
      assert.equal(find(1004).cardio.duration_s, 5400);
      assert.equal(find(1005).cardio.sport, 'row');
      assert.equal(find(9001).cardio.distance_m, 10000); // from the history import
      assert.equal(find(9001).notes, null); // summary only: no details fetched
      const lifted = all.find((w) => w.id === lift.body.workout.id);
      assert.equal(lifted.strava.activity_id, '1006');
      assert.equal(lifted.metrics.avg_hr, 112);
      assert.equal(lifted.metrics.max_hr, 151);
      assert.equal(all.filter((w) => w.kind === 'cardio').length, 6);
    });

    await test('a workout logged later picks up the unmatched lifting session', async () => {
      const r = await call('POST', '/workouts', { date: dateOf(at(0, 10)), name: 'Upper', duration_minutes: 60, sets: [{ exercise_id: 2, set_number: 1, reps: 5, weight: 185 }] });
      assert.equal(r.status, 201);
      assert.equal(r.body.workout.strava.activity_id, '1007');
      assert.equal(r.body.workout.metrics.avg_hr, 120);
      assert.equal((await call('GET', '/strava/status')).body.counts.strength_unmatched, 0);
    });

    await test('syncing again imports nothing new', async () => {
      const before = (await workouts()).length;
      const r = await call('POST', '/strava/sync');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      // The lifting session linked in the last test gets its heart rate data now
      assert.deepEqual(r.body.result, { imported: 0, linked: 0, updated: 0, unmatched: 0, analysed: 1, rate_limited: false, error: null });
      assert.equal((await workouts()).length, before);
    });

    await test('a session deleted here is not imported again', async () => {
      const climb = (await byStrava()).find((w) => w.strava?.activity_id === '1004');
      assert.equal((await call('DELETE', `/workouts/${climb.id}`)).status, 200);
      // Make the next sync look at it again
      fake.state.activities.push(activity(1008, 'Run', at(0, 6), { distance: 3000 }));
      await call('POST', '/strava/sync');
      const all = await byStrava();
      assert.equal(all.some((w) => w.strava?.activity_id === '1004'), false);
      assert.equal(all.some((w) => w.strava?.activity_id === '1008'), true);
    });

    await test('refreshes an expired token before calling Strava', async () => {
      // Reconnect so the stored token is already expired
      const auth = await call('POST', '/strava/authorize', { redirect_uri: 'http://localhost:5173/strava/callback' });
      fake.state.expireNextToken = true;
      fake.state.tokenGrants = [];
      const requestsBefore = fake.state.requests.length;
      await call('POST', '/strava/exchange', { code: 'good-code', state: new URL(auth.body.url).searchParams.get('state'), scope: 'read,activity:read_all' });
      await call('POST', '/strava/sync'); // waits for the background sync too
      assert.deepEqual(fake.state.tokenGrants, ['authorization_code', 'refresh_token']);
      const [expired, refreshed] = fake.state.issuedTokens.slice(-2);
      const used = new Set(fake.state.requests.slice(requestsBefore).map((r) => r.token));
      assert.deepEqual([...used], [refreshed]);
      assert.notEqual(expired, refreshed);
      const status = (await call('GET', '/strava/status')).body;
      assert.equal(status.history_imported, true); // reconnecting the same athlete kept the progress
    });

    await test('stops cleanly at the rate limit', async () => {
      fake.state.activities.push(activity(1009, 'Run', at(0, 7), { distance: 4000 }));
      fake.state.rateLimitAfter = 1; // the list works, the details request is refused
      const r = await call('POST', '/strava/sync');
      fake.state.rateLimitAfter = null;
      assert.equal(r.status, 200);
      assert.equal(r.body.result.rate_limited, true);
      assert.equal((await byStrava()).some((w) => w.strava?.activity_id === '1009'), false);
      const again = await call('POST', '/strava/sync');
      assert.equal(again.body.result.imported, 1);
    });

    const idOf = async (activityId) => (await byStrava()).find((w) => w.strava?.activity_id === String(activityId))?.id;

    await test('analysis: an outdoor run gets charts, route and best efforts', async () => {
      const requests = fake.state.streamRequests.length;
      const r = await call('GET', `/cardio/${await idOf(1001)}/analysis`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.status, 'ok');
      assert.equal(fake.state.streamRequests.length, requests); // fetched during the sync, not now
      assert.ok(r.body.series.length > 100 && r.body.series.length <= 500);
      assert.ok(r.body.series.every((p) => p.t >= 0 && p.hr > 0 && p.d >= 0));
      assert.ok(r.body.route.length > 100);
      assert.equal(r.body.has_hr, true);
      assert.equal(r.body.zones, null); // no heart rate settings yet
      const efforts = Object.fromEntries(r.body.best_efforts.map((e) => [e.key, e]));
      assert.deepEqual(Object.keys(efforts), ['400m', '1k', '1mi', '5k']);
      // The fast kilometre is 25% quicker than the run's average pace
      const pace = 1800 / 8046.7;
      assert.ok(Math.abs(efforts['1k'].seconds - (1000 * pace) / 1.25) < 2, `1k: ${efforts['1k'].seconds}`);
      // The older, faster 10 km run holds the records
      assert.equal(efforts['5k'].record, false);
      const old = await call('GET', `/cardio/${await idOf(9001)}/analysis`);
      assert.equal(old.body.best_efforts.find((e) => e.key === '5k').record, true);
      assert.deepEqual(old.body.best_efforts.map((e) => e.key), ['400m', '1k', '1mi', '5k', '10k']);
    });

    await test('analysis: no records indoors; activities without data say so', async () => {
      const treadmill = await call('GET', `/cardio/${await idOf(1002)}/analysis`);
      assert.equal(treadmill.body.status, 'ok');
      assert.deepEqual(treadmill.body.best_efforts, []);
      assert.equal(treadmill.body.route, null);
      const ride = await call('GET', `/cardio/${await idOf(1003)}/analysis`);
      assert.deepEqual(ride.body.best_efforts, []);

      fake.state.activities.push(activity(1011, 'RockClimbing', at(0, 5), { moving_time: 0, elapsed_time: 3600 }));
      await call('POST', '/strava/sync');
      const climb = await call('GET', `/cardio/${await idOf(1011)}/analysis`);
      assert.equal(climb.body.status, 'none');
      assert.deepEqual(climb.body.series, []);
      // Logged by hand, nothing to fetch
      const manual = await call('POST', '/cardio', { date: dateOf(at(0, 5)), sport: 'row', duration_s: 600 });
      assert.equal((await call('GET', `/cardio/${manual.body.workout.id}/analysis`)).body.status, 'unavailable');

      const before = fake.state.streamRequests.length;
      const lifted = await call('GET', `/cardio/${lift.body.workout.id}/analysis`);
      assert.equal(lifted.body.status, 'ok');
      assert.equal(lifted.body.has_hr, true);
      assert.equal(fake.state.streamRequests.length, before);
      assert.equal((await callOther('GET', `/cardio/${lift.body.workout.id}/analysis`)).status, 404);
    });

    await test('heart rate settings: suggestion, checks, zones', async () => {
      const empty = await call('GET', '/cardio/thresholds');
      assert.deepEqual(empty.body.thresholds, []);
      assert.equal(empty.body.zones, null);
      assert.equal(empty.body.suggestion.max_hr, 165);
      assert.equal((await call('POST', '/cardio/thresholds', { effective_date: '2020-01-01', max_hr: 300 })).status, 400);
      assert.equal((await call('POST', '/cardio/thresholds', { effective_date: '2020-01-01', max_hr: 180, resting_hr: 170 })).status, 400);
      const saved = await call('POST', '/cardio/thresholds', { effective_date: '2020-01-01', max_hr: 190 });
      assert.equal(saved.status, 201, JSON.stringify(saved.body));
      assert.equal(saved.body.zones[4].min, 171);
      // Same date again replaces it
      const replaced = await call('POST', '/cardio/thresholds', { effective_date: '2020-01-01', max_hr: 180, resting_hr: 50 });
      assert.equal(replaced.body.thresholds.length, 1);
      assert.equal(replaced.body.zones[0].min, 115); // 50 + 0.5 × 130
    });

    await test('zones: weekly time, strength and cardio, using the dated settings', async () => {
      const run = await call('GET', `/cardio/${await idOf(1001)}/analysis`);
      const total = run.body.zones.seconds.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 1799) <= 1, `total ${total}`);
      const r = await call('GET', '/cardio/zones?weeks=4');
      assert.equal(r.status, 200);
      assert.equal(r.body.has_thresholds, true);
      assert.equal(r.body.weekly.length, 4);
      assert.ok(r.body.sessions_counted >= 6);
      assert.ok(r.body.by_kind.strength.some((s) => s > 0));
      assert.ok(r.body.by_kind.cardio.reduce((a, b) => a + b, 0) > r.body.by_kind.strength.reduce((a, b) => a + b, 0));
      const minutes = r.body.weekly.reduce((sum, w) => sum + w.z1 + w.z2 + w.z3 + w.z4 + w.z5, 0);
      assert.ok(Math.abs(minutes * 60 - r.body.totals.reduce((a, b) => a + b, 0)) < 300);
    });

    await test('training load: every session counts, heart rate first', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const r = await call('GET', `/cardio/load?weeks=4&localDate=${today}`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.needs_thresholds, false);
      assert.equal(r.body.assumed_resting_hr, false);
      // Three full weeks, then this week up to today
      assert.equal(r.body.daily.length, 21 + new Date(`${today}T00:00:00Z`).getUTCDay() + 1);
      assert.equal(r.body.daily.at(-1).date, today);
      assert.ok(r.body.today.fitness > 0 && r.body.today.fatigue > r.body.today.fitness);
      assert.ok(['fresh', 'neutral', 'productive', 'overreaching'].includes(r.body.today.status));
      assert.ok(r.body.sources.hr_detail >= 6);
      assert.ok(r.body.weekly.some((w) => w.strength > 0) && r.body.weekly.some((w) => w.cardio > 0));
      const noSettings = await callOther('GET', '/cardio/load');
      assert.equal(noSettings.body.needs_thresholds, true);
    });

    await test('running: records, VDOT and predictions', async () => {
      const r = await call('GET', '/cardio/running?weeks=12');
      assert.equal(r.status, 200);
      const fiveK = r.body.records.find((x) => x.key === '5k');
      assert.ok(fiveK.best && fiveK.recent);
      assert.equal(r.body.records.find((x) => x.key === 'marathon').best, null);
      assert.ok(r.body.vdot.value > 20 && r.body.vdot.value < 80);
      assert.deepEqual(r.body.predictions.map((p) => p.key), ['5k', '10k', 'half', 'marathon']);
      assert.ok(r.body.predictions[0].seconds < r.body.predictions[3].seconds);
      // The old run (400 days ago) counts for all-time, not the last 12 weeks
      const tenK = r.body.records.find((x) => x.key === '10k');
      assert.ok(tenK.best);
      assert.equal(tenK.recent, null);
    });

    await test('deleting a session removes its stored data', async () => {
      const id = await idOf(1005);
      const file = path.join(tmp, 'streams', `${id}.json.gz`);
      assert.ok(fs.existsSync(file));
      await call('DELETE', `/workouts/${id}`);
      assert.equal(fs.existsSync(file), false);
    });

    await test('lifting without a duration takes Strava\'s elapsed time', async () => {
      const noDuration = await call('POST', '/workouts', { date: dateOf(at(2, 18)), name: 'Pull', sets: [{ exercise_id: 2, set_number: 1, reps: 5, weight: 135 }] });
      const withDuration = await call('POST', '/workouts', { date: dateOf(at(3, 18)), name: 'Push', duration_minutes: 45, sets: [{ exercise_id: 2, set_number: 1, reps: 5, weight: 155 }] });
      assert.equal(noDuration.body.workout.duration_minutes, null);
      fake.state.activities.push(
        activity(1013, 'WeightTraining', at(2, 18), { elapsed_time: 3890, moving_time: 900 }),
        activity(1014, 'WeightTraining', at(3, 18), { elapsed_time: 3000, moving_time: 700 }),
      );
      await call('POST', '/strava/sync');
      const pull = (await call('GET', `/workouts/${noDuration.body.workout.id}`)).body.workout;
      const push = (await call('GET', `/workouts/${withDuration.body.workout.id}`)).body.workout;
      assert.equal(pull.strava.activity_id, '1013');
      assert.equal(pull.duration_minutes, 65); // 3890 s elapsed, not the 15 min "moving"
      assert.equal(push.strava.activity_id, '1014');
      assert.equal(push.duration_minutes, 45); // its own duration is kept
    });

    await test('webhook: verification handshake', async () => {
      const ok = await fetch(`${app.base}/api/strava/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123`);
      assert.deepEqual(await ok.json(), { 'hub.challenge': 'abc123' });
      const bad = await fetch(`${app.base}/api/strava/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc123`);
      assert.equal(bad.status, 403);
    });

    const hook = (event) => fetch(`${app.base}/api/strava/webhook`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: ATHLETE.id, object_type: 'activity', ...event }),
    });

    await test('webhook: a new activity arrives with details', async () => {
      fake.state.activities.push(activity(1010, 'Ride', at(0, 8), { distance: 20000, start_latlng: [1, 2] }));
      assert.equal((await hook({ aspect_type: 'create', object_id: 1010 })).status, 200);
      await waitFor(async () => (await byStrava()).some((w) => w.strava?.activity_id === '1010'), 'the webhook import');
      const ride = (await byStrava()).find((w) => w.strava?.activity_id === '1010');
      assert.equal(ride.cardio.environment, 'outdoor');
      assert.equal(ride.notes, 'From the watch');
    });

    await test('webhook: an update renames, and a type change moves it', async () => {
      const a = fake.state.activities.find((x) => x.id === 1010);
      a.name = 'Renamed ride';
      await hook({ aspect_type: 'update', object_id: 1010, updates: { title: 'Renamed ride' } });
      await waitFor(async () => (await byStrava()).some((w) => w.name === 'Renamed ride'), 'the rename');

      a.sport_type = 'Run';
      a.type = 'Run';
      await hook({ aspect_type: 'update', object_id: 1010, updates: { type: 'Run' } });
      await waitFor(async () => (await byStrava()).find((w) => w.strava?.activity_id === '1010')?.cardio.sport === 'run', 'the type change');
    });

    await test('webhook: deletes only what Strava really deleted', async () => {
      // Still on Strava: a forged delete does nothing
      await hook({ aspect_type: 'delete', object_id: 1010 });
      await sleep(400);
      assert.ok((await byStrava()).some((w) => w.strava?.activity_id === '1010'));

      fake.state.activities = fake.state.activities.filter((x) => x.id !== 1010 && x.id !== 1007);
      await hook({ aspect_type: 'delete', object_id: 1010 });
      await hook({ aspect_type: 'delete', object_id: 1007 });
      await waitFor(async () => !(await byStrava()).some((w) => w.strava?.activity_id === '1010'), 'the delete');
      await waitFor(async () => {
        const upper = (await byStrava()).find((w) => w.name === 'Upper');
        return upper && !upper.strava && !upper.metrics;
      }, 'the lifting HR to be removed');
    });

    await test('webhook: events for unknown athletes are ignored', async () => {
      const r = await fetch(`${app.base}/api/strava/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: 1, object_type: 'activity', aspect_type: 'create', object_id: 1001 }) });
      assert.equal(r.status, 200);
    });

    await test('another account cannot connect the same Strava athlete', async () => {
      const auth = await callOther('POST', '/strava/authorize', { redirect_uri: 'http://localhost:5173/strava/callback' });
      const r = await callOther('POST', '/strava/exchange', { code: 'good-code', state: new URL(auth.body.url).searchParams.get('state'), scope: 'read,activity:read_all' });
      assert.equal(r.status, 409);
    });

    await test('disconnecting keeps imported sessions', async () => {
      const count = (await workouts()).length;
      const r = await call('DELETE', '/strava/connection');
      assert.equal(r.body.connected, false);
      assert.equal((await workouts()).length, count);
    });

    await test('webhook: athlete deauthorizing on strava.com disconnects', async () => {
      const auth = await call('POST', '/strava/authorize', { redirect_uri: 'http://localhost:5173/strava/callback' });
      await call('POST', '/strava/exchange', { code: 'good-code', state: new URL(auth.body.url).searchParams.get('state'), scope: 'read,activity:read_all' });
      await sleep(300);
      await fetch(`${app.base}/api/strava/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: ATHLETE.id, object_type: 'athlete', aspect_type: 'update', object_id: ATHLETE.id, updates: { authorized: 'false' } }) });
      await waitFor(async () => !(await call('GET', '/strava/status')).body.connected, 'the disconnect');
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fake.server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll Strava tests passed');
process.exit(failures ? 1 : 0);
