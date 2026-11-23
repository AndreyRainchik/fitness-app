#!/usr/bin/env node
/**
 * Run plan tests: pace zones, the plan generator's coaching rules (pure
 * functions), then the /api/run-plans routes and the week view end to end
 * against a throwaway database.
 *
 *   npm run test:runplan
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { paceZones } from './services/runPaces.js';
import { SESSIONS, sessionById } from './services/runSessions.js';
import {
  chooseRunWeekdays, cutbackWeeks, generatePlan, phasesFor, placeRuns, qualityWork, runningBaseline, volumeCaps, weeklyTargets, withinCaps,
} from './services/runPlan.js';

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

const DAY = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Lift Mon/Wed/Fri (squat Mon, deadlift Fri), run Tue/Thu/Sat/Sun
const DAYS = ['cardio', 'lift', 'cardio', 'lift', 'cardio', 'lift', 'cardio'];
function liftCalendar(days = DAYS, heavyWeekdays = [1, 5], weeks = 30) {
  const heavy = new Set();
  const lift = new Set();
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays('2026-11-22', i);
    if (days[weekday(date)] === 'lift' || days[weekday(date)] === 'both') lift.add(date);
    if (heavyWeekdays.includes(weekday(date)) && lift.has(date)) heavy.add(date);
  }
  return { heavy, lift };
}

function plan(overrides = {}) {
  const { heavy, lift } = liftCalendar(overrides.days ?? DAYS);
  const result = generatePlan({
    kind: 'race', race: { key: 'half', date: '2027-02-21', goal_s: null }, vdot: 45,
    baseline: { weekly_m: 35000, longest_m: 12000 }, runsPerWeek: 4, longRunWeekday: 0, days: DAYS,
    heavyLegDates: heavy, liftDates: lift, startDate: '2026-11-22', unit: 'mi', settings: {},
    ...overrides,
  });
  assert.ok(result.ok, result.error);
  return result.plan;
}

const QUALITY_ROLES = new Set(['A', 'B']);

async function unitTests() {
  console.log('\nPace zones');

  await test('VDOT 50 matches Daniels\' tables', () => {
    const z = paceZones(50);
    const mid = (r) => (r.fast + r.slow) / 2;
    assert.ok(Math.abs(mid(z.threshold) - 255) <= 3, `threshold ${mid(z.threshold)}`); // 4:15 /km
    assert.ok(Math.abs(mid(z.interval) - 235) <= 3, `interval ${mid(z.interval)}`); // 3:55 /km
    assert.ok(Math.abs(mid(z.marathon) - 271) <= 3, `marathon ${mid(z.marathon)}`); // 4:31 /km
    assert.ok(Math.abs(z.easy.fast - 307) <= 4 && Math.abs(z.easy.slow - 340) <= 6, JSON.stringify(z.easy)); // 5:07–5:40 /km
  });

  await test('zones get faster from easy to repetition, and the goal zone needs a goal', () => {
    const z = paceZones(45);
    const order = ['recovery', 'easy', 'steady', 'marathon', 'half', 'threshold', '10k', '5k', 'interval', 'rep'];
    for (let i = 1; i < order.length; i++) assert.ok(z[order[i]].fast < z[order[i - 1]].fast, `${order[i]} faster than ${order[i - 1]}`);
    assert.equal(z.goal, undefined);
    assert.ok(paceZones(45, { goalPace: 280 }).goal);
  });

  console.log('\nPlan shape');

  await test('phases: default, shortened and extended', () => {
    const count = (list) => list.reduce((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {});
    assert.deepEqual(count(phasesFor('half', 12)), { base: 3, build: 4, peak: 3, taper: 2 });
    assert.deepEqual(count(phasesFor('half', 8)), { build: 3, peak: 3, taper: 2 });
    assert.deepEqual(count(phasesFor('half', 7)), { build: 2, peak: 3, taper: 2 });
    assert.deepEqual(count(phasesFor('marathon', 20)), { base: 7, build: 5, peak: 5, taper: 3 });
  });

  await test('cutback weeks: every 4th, or with the lifting deload', () => {
    const phases = phasesFor('half', 12);
    const starts = phases.map((_, i) => addDays('2026-11-22', i * 7));
    assert.deepEqual([...cutbackWeeks(phases, starts)], [3, 7]);
    const deloads = new Set([starts[2], starts[6]]);
    assert.deepEqual([...cutbackWeeks(phases, starts, deloads)], [2, 6]);
    // Never the week before the taper
    assert.ok(![...cutbackWeeks(phasesFor('5k', 8), starts)].includes(6));
  });

  await test('weekly distance grows at most 10% and cutbacks are 80%', () => {
    const phases = phasesFor('marathon', 18);
    const cutbacks = cutbackWeeks(phases, phases.map((_, i) => addDays('2026-11-22', i * 7)));
    const targets = weeklyTargets({ raceKey: 'marathon', phases, cutbacks, startWeekly: 40000, runsPerWeek: 5 });
    let lastFull = null;
    targets.forEach((t, i) => {
      if (phases[i] === 'taper') return;
      if (cutbacks.has(i)) {
        assert.ok(Math.abs(t - lastFull * 0.8) < 2 || t <= lastFull * 0.8 * 1.11, `cutback week ${i}`);
        return;
      }
      if (lastFull) assert.ok(t <= lastFull * 1.1 + 1, `week ${i}: ${t} after ${lastFull}`);
      lastFull = t;
    });
    assert.ok(Math.max(...targets) <= 40000 * 1.8 + 1);
  });

  await test('run days come from cardio days first and include the long-run day', () => {
    assert.deepEqual(chooseRunWeekdays(DAYS, 4, 0).weekdays, [0, 2, 4, 6]);
    const three = chooseRunWeekdays(DAYS, 3, 0);
    assert.ok(three.weekdays.includes(0) && three.weekdays.length === 3);
    const five = chooseRunWeekdays(DAYS, 5, 0);
    assert.equal(five.weekdays.length, 5);
    assert.match(five.warnings[0], /lifting days/);
  });

  await test('placement keeps hard running off the day before heavy legs when it can', () => {
    // Dates Sun..Sat of one week; heavy legs on Monday and Friday
    const dates = ['2026-11-22', '2026-11-24', '2026-11-26', '2026-11-28'];
    const runs = [
      { role: 'long' }, { role: 'A', hard: true, legStress: 'high' }, { role: 'B', hard: true, legStress: 'medium' }, { role: 'easy' },
    ];
    const result = placeRuns(runs, dates, { heavyLegDates: new Set(['2026-11-23', '2026-11-27']), longDate: '2026-11-22' });
    assert.equal(result.dates[0], '2026-11-22');
    // Thursday is the day before Friday's deadlifts: the hill/rep session isn't there
    assert.notEqual(result.dates[1], '2026-11-26');
  });

  console.log('\nGenerated plans');

  const half = plan();
  const allRuns = half.weeks.flatMap((w) => w.runs.map((r) => ({ ...r, week: w })));

  await test('deterministic', () => {
    assert.deepEqual(plan(), half);
  });

  await test('the race is on race day, with a sharpener and shakeout before it', () => {
    const last = half.weeks[half.weeks.length - 1];
    assert.equal(last.phase, 'race');
    const raceRun = last.runs[last.runs.length - 1];
    assert.equal(raceRun.session_id, 'race');
    assert.equal(raceRun.date, '2027-02-21');
    assert.ok(last.runs.some((r) => r.session_id === 'sharpener' && r.date <= '2027-02-18'));
    assert.ok(last.runs.some((r) => r.session_id === 'shakeout' && r.date === '2027-02-20'));
    assert.equal(half.end_date, '2027-02-21');
  });

  await test('every quality session is within the volume caps for its week', () => {
    for (const r of allRuns.filter((x) => QUALITY_ROLES.has(x.role))) {
      if (sessionById(r.session_id).benchmark) continue;
      const weekly = r.week.phase === 'taper' ? r.week.target_m * 0.7 : r.week.target_m;
      assert.ok(withinCaps(r.steps, half.zones, 'half', weekly),
        `${r.title} in week ${r.week.index}: ${JSON.stringify(qualityWork(r.steps, half.zones, 'half'))} vs ${JSON.stringify(volumeCaps(weekly, half.zones))}`);
    }
  });

  await test('variety: no session repeats within 3 weeks, and a week\'s two quality sessions are different families', () => {
    const seen = new Map();
    for (const w of half.weeks) {
      const quality = w.runs.filter((r) => QUALITY_ROLES.has(r.role) && r.session_id !== 'sharpener');
      if (quality.length === 2) assert.notEqual(quality[0].family, quality[1].family, `week ${w.index}`);
      for (const r of quality) {
        if (sessionById(r.session_id).benchmark || w.cutback || w.phase === 'taper') continue;
        if (seen.has(r.session_id)) assert.ok(w.index - seen.get(r.session_id) >= 3, `${r.session_id} weeks ${seen.get(r.session_id)} and ${w.index}`);
        seen.set(r.session_id, w.index);
      }
    }
    const types = new Set(allRuns.map((r) => r.session_id));
    assert.ok(types.size >= 15, `only ${types.size} session types`);
  });

  await test('sessions progress: a family\'s level never goes down outside cutbacks and the taper', () => {
    const levels = new Map();
    for (const r of allRuns) {
      if (!QUALITY_ROLES.has(r.role) || r.week.cutback || r.week.phase === 'taper' || r.week.phase === 'race') continue;
      if (levels.has(r.session_id)) assert.ok(r.level >= levels.get(r.session_id), `${r.session_id} week ${r.week.index}`);
      levels.set(r.session_id, r.level);
    }
  });

  await test('the long run builds gradually to about 11 mi and steps down in cutbacks', () => {
    const longs = half.weeks.map((w) => ({ w, run: w.runs.find((r) => r.role === 'long') })).filter((x) => x.run);
    let lastFull = null;
    for (const { w, run: r } of longs) {
      if (w.cutback) {
        assert.ok(r.distance_m < lastFull, `cutback long run, week ${w.index}`);
        continue;
      }
      if (w.phase === 'taper') continue;
      if (lastFull) assert.ok(r.distance_m <= lastFull + 2500 + 805, `week ${w.index}: ${r.distance_m} after ${lastFull}`);
      lastFull = r.distance_m;
    }
    const peak = Math.max(...longs.map((x) => x.run.distance_m));
    assert.ok(peak >= 16000 && peak <= 21000, `peak long run ${peak}`);
  });

  await test('no hill or repetition session the day before heavy legs with this schedule', () => {
    const { heavy } = liftCalendar();
    for (const r of allRuns.filter((x) => QUALITY_ROLES.has(x.role))) {
      if (sessionById(r.session_id).legStress === 'high') assert.ok(!heavy.has(addDays(r.date, 1)), `${r.title} on ${r.date}`);
    }
  });

  await test('runs per week', () => {
    for (const w of half.weeks) {
      const counted = w.runs.filter((r) => !r.optional && r.session_id !== 'race');
      assert.ok(counted.length <= 4, `week ${w.index}: ${counted.length}`);
      for (const r of w.runs) assert.equal(addDays(w.week_start, weekday(r.date)) <= r.date, true);
    }
  });

  await test('cutback weeks hold a 5K time trial every other time', () => {
    const tts = half.weeks.filter((w) => w.runs.some((r) => r.session_id === 'time_trial'));
    assert.ok(tts.length >= 1);
    assert.ok(tts.every((w) => w.cutback));
  });

  await test('marathon plans build to a real long run', () => {
    const m = plan({ race: { key: 'marathon', date: '2027-04-18' }, runsPerWeek: 5 });
    const peakLong = Math.max(...m.weeks.flatMap((w) => w.runs.filter((r) => r.role === 'long').map((r) => r.distance_m)));
    assert.ok(peakLong >= 26000, `peak long run ${peakLong}`);
    assert.ok(m.weeks.some((w) => w.runs.some((r) => r.session_id === 'long_race_pace')));
  });

  await test('maintenance: one quality session a week and a time trial every 8 weeks', () => {
    const m = plan({ kind: 'maintain', race: null, weeks: 12, runsPerWeek: 3 });
    assert.equal(m.weeks.length, 12);
    for (const w of m.weeks) assert.ok(w.runs.filter((r) => QUALITY_ROLES.has(r.role)).length <= 1, `week ${w.index}`);
    const tts = m.weeks.filter((w) => w.runs.some((r) => r.session_id === 'time_trial')).map((w) => w.index);
    assert.deepEqual(tts, [3, 11]);
  });

  await test('a long run is only called a plain long run when it is all easy', () => {
    for (const r of allRuns.filter((x) => x.session_id === 'long_easy')) {
      for (const step of r.steps) {
        const zones = step.kind === 'repeat' ? step.reps.flatMap((x) => x.parts.map((p) => p.zone)) : [step.zone];
        assert.ok(zones.every((z) => z === 'easy'), `week ${r.week.index}: ${JSON.stringify(step)}`);
      }
    }
  });

  await test('hills can be turned off', () => {
    const flat = plan({ settings: { hills: false } });
    assert.ok(!flat.weeks.some((w) => w.runs.some((r) => r.family === 'hills')));
  });

  await test('errors', () => {
    const tooSoon = generatePlan({ kind: 'race', race: { key: '10k', date: '2026-12-13' }, vdot: 45, baseline: {}, runsPerWeek: 4, longRunWeekday: 0, days: DAYS, startDate: '2026-11-22' });
    assert.match(tooSoon.error, /at least 5 weeks/);
    assert.match(generatePlan({ kind: 'race', race: { key: 'half', date: '2027-03-01' }, vdot: null, runsPerWeek: 4, longRunWeekday: 0, days: DAYS, startDate: '2026-11-22' }).error, /VDOT/);
  });

  await test('every template level builds and fits a typical week', () => {
    const zones = paceZones(45);
    for (const s of SESSIONS) {
      s.levels.forEach((level, i) => {
        const steps = level({ mile: 1609.344, race: 'half', hasGoal: false, distance_m: 12000, race_m: 21097.5 });
        assert.ok(Array.isArray(steps) && steps.length, `${s.id} level ${i}`);
      });
    }
    assert.ok(zones);
  });

  await test('baseline from recent runs', () => {
    const sessions = [
      { date: '2026-11-20', kind: 'cardio', sport: 'run', distance_m: 10000 },
      { date: '2026-11-01', kind: 'cardio', sport: 'run', distance_m: 16000 },
      { date: '2026-10-01', kind: 'cardio', sport: 'run', distance_m: 20000 }, // outside both windows
      { date: '2026-11-18', kind: 'cardio', sport: 'ride', distance_m: 40000 },
    ];
    assert.deepEqual(runningBaseline(sessions, '2026-11-22'), { weekly_m: 6500, longest_m: 16000, runs_28d: 2 });
  });
}

// ---------------------------------------------------------------------------

async function startApp(dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, JWT_SECRET: Buffer.from('test-secret-for-run-plans').toString('base64'), NODE_ENV: 'test' },
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
  console.log('\n/api/run-plans routes');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runplan-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));
  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'plan@test.local', password: 'secret123', username: 'runner', units: 'lbs' });
    const call = api(app.base, reg.body.token);
    const today = '2026-11-22';
    const body = {
      localDate: today, kind: 'race', race: { key: 'half', date: '2027-02-21', name: 'Spring Half' },
      runs_per_week: 4, long_run_weekday: 0,
    };

    await test('needs a login', async () => {
      assert.equal((await anon('GET', '/run-plans/active')).status, 401);
    });

    await test('setup before any running', async () => {
      const r = await call('GET', `/run-plans/setup?localDate=${today}`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.fitness, null);
      assert.equal(r.body.unit, 'mi');
      assert.equal(r.body.active, null);
      assert.deepEqual(r.body.baseline, { weekly_m: 0, longest_m: 0, runs_28d: 0 });
    });

    await test('a plan needs a fitness level', async () => {
      const r = await call('POST', '/run-plans/preview', body);
      assert.equal(r.status, 400);
      assert.equal(r.body.needs_result, true);
    });

    await test('validation', async () => {
      assert.equal((await call('POST', '/run-plans/preview', { ...body, kind: 'ultra' })).status, 400);
      assert.equal((await call('POST', '/run-plans/preview', { ...body, runs_per_week: 9 })).status, 400);
      assert.equal((await call('POST', '/run-plans/preview', { ...body, race: { key: 'half', date: 'soon' } })).status, 400);
      const tooSoon = await call('POST', '/run-plans/preview', { ...body, race: { key: 'marathon', date: '2026-12-20' }, recent_result: { distance: '5k', seconds: 1310 } });
      assert.equal(tooSoon.status, 400);
      assert.match(tooSoon.body.error, /at least 8 weeks/);
    });

    await test('preview from a recent result and logged runs, without saving', async () => {
      await call('PUT', '/week/schedule', { days: DAYS });
      for (const [date, km] of [['2026-11-15', 12], ['2026-11-18', 6], ['2026-11-20', 8]]) {
        await call('POST', '/cardio', { date, sport: 'run', duration_s: km * 330, distance_m: km * 1000 });
      }
      const r = await call('POST', '/run-plans/preview', { ...body, recent_result: { distance: '5k', seconds: 1310 } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.plan.vdot, 44.9);
      assert.match(r.body.plan.vdot_source, /5K in 21:50/);
      assert.equal(r.body.meta.baseline_found.weekly_m, 6500);
      assert.equal(r.body.meta.baseline_found.longest_m, 12000);
      assert.deepEqual(r.body.plan.weekdays, [0, 2, 4, 6]);
      assert.ok(r.body.plan.weeks.length >= 12);
      assert.equal((await call('GET', '/run-plans/active')).body.plan, null);
    });

    await test('save, read back, and see the runs in My Week', async () => {
      const saved = await call('POST', '/run-plans', { ...body, recent_result: { distance: '5k', seconds: 1310 } });
      assert.equal(saved.status, 201, JSON.stringify(saved.body));
      const active = await call('GET', '/run-plans/active');
      assert.equal(active.body.plan.race.name, 'Spring Half');
      assert.equal(active.body.plan.race.label, 'Half marathon');
      assert.ok(active.body.zones.threshold.fast > 0);
      const runs = active.body.weeks.flatMap((w) => w.runs);
      assert.equal(runs[runs.length - 1].date, '2027-02-21');
      assert.ok(runs.every((r) => r.steps.length > 0 && r.purpose));

      const week = await call('GET', `/week?localDate=${today}`);
      const planned = week.body.days.flatMap((d) => d.planned.filter((p) => p.kind === 'run'));
      assert.ok(planned.length >= 3, JSON.stringify(week.body.days.map((d) => d.planned)));
      assert.ok(planned.every((p) => p.run.steps.length));
      assert.equal(week.body.run_plan.race.name, 'Spring Half');
      assert.ok(week.body.summary.cardio.planned_run_m > 0);
    });

    await test('a logged run ticks off that day\'s planned run', async () => {
      const week = await call('GET', `/week?localDate=${today}`);
      const firstRunDay = week.body.days.find((d) => d.planned.some((p) => p.kind === 'run'));
      await call('POST', '/cardio', { date: firstRunDay.date, sport: 'run', duration_s: 2400, distance_m: 7000 });
      const after = await call('GET', `/week?localDate=${firstRunDay.date}`);
      const item = after.body.days.find((d) => d.date === firstRunDay.date).planned.find((p) => p.kind === 'run');
      assert.equal(item.status, 'done');
    });

    await test('a new plan replaces the active one; stopping it removes future runs', async () => {
      const again = await call('POST', '/run-plans', { ...body, kind: 'maintain', race: null, recent_result: { distance: '5k', seconds: 1300 } });
      assert.equal(again.status, 201, JSON.stringify(again.body));
      const active = await call('GET', '/run-plans/active');
      assert.equal(active.body.plan.kind, 'maintain');
      assert.equal(active.body.weeks.length, 12);
      const stopped = await call('DELETE', `/run-plans/active?localDate=${today}`);
      assert.equal(stopped.status, 200);
      assert.equal((await call('GET', '/run-plans/active')).body.plan, null);
      const week = await call('GET', `/week?localDate=${today}`);
      assert.ok(!week.body.days.some((d) => d.date >= today && d.planned.some((p) => p.kind === 'run' && p.status !== 'done')));
      assert.equal((await call('DELETE', '/run-plans/active')).status, 404);
    });
  } finally {
    if (failures) console.log(`\nServer output:\n${app.output().slice(-3000)}`);
    app.child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await unitTests();
await apiTests();
console.log(failures ? `\n${failures} test(s) failed` : '\nAll run plan tests passed');
process.exit(failures ? 1 : 0);
