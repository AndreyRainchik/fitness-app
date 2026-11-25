#!/usr/bin/env node
/**
 * Program tests: skipping and pausing lifts, and what they do to training
 * maxes. The adjustment rule as a unit, then the /api/programs routes end to
 * end against a throwaway database.
 *
 *   npm run test:programs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Program, { UNIT_RULES } from './models/Program.js';
import { convertWeight } from './utils/units.js';

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

async function unitTests() {
  console.log('\n5/3/1 cycle-end adjustment');

  await test('week 3 AMRAP reps decide the change', () => {
    assert.equal(Program.getDefault531Adjustment([{ week: 3, status: 'completed', amrap_reps: 12 }]), 'increment_2x');
    assert.equal(Program.getDefault531Adjustment([{ week: 3, status: 'completed', amrap_reps: 6 }]), 'increment_1x');
    assert.equal(Program.getDefault531Adjustment([{ week: 3, status: 'completed', amrap_reps: 2 }]), 'keep');
    assert.equal(Program.getDefault531Adjustment([]), 'increment_1x');
  });

  await test('a lift skipped in weeks 1-3 keeps its training max', () => {
    assert.equal(Program.getDefault531Adjustment([{ week: 1, status: 'skipped' }, { week: 3, status: 'completed', amrap_reps: 12 }]), 'keep');
    assert.equal(Program.getDefault531Adjustment([1, 2, 3, 4].map((week) => ({ week, status: 'skipped' }))), 'keep');
  });

  await test('skipping only the deload week doesn\'t hold progress back', () => {
    assert.equal(Program.getDefault531Adjustment([{ week: 3, status: 'completed', amrap_reps: 6 }, { week: 4, status: 'skipped' }]), 'increment_1x');
  });

  await test('a failed week still means a decrease', () => {
    assert.equal(Program.getDefault531Adjustment([{ week: 1, status: 'skipped' }, { week: 2, status: 'failed' }]), 'decrement_1x');
  });
  console.log('\nUnits');

  await test('warm-ups round to the unit\'s step and never go below the bar', () => {
    assert.deepEqual(Program.getWarmupSets(300, UNIT_RULES.lbs).map((w) => w.weight), [120, 150, 180]);
    assert.deepEqual(Program.getWarmupSets(100, UNIT_RULES.lbs).map((w) => w.weight), [45, 50, 60]);
    assert.deepEqual(Program.getWarmupSets(85, UNIT_RULES.kg).map((w) => w.weight), [35, 42.5, 50]);
    assert.deepEqual(Program.getWarmupSets(40, UNIT_RULES.kg).map((w) => w.weight), [20, 20, 25]);
    // A user's own bar, e.g. a 15 kg bar
    assert.deepEqual(Program.getWarmupSets(30, { ...UNIT_RULES.kg, bar: 15 }).map((w) => w.weight), [15, 15, 17.5]);
  });

  await test('5/3/1 sets round to 2.5 in either unit; steps are 5/10 lb or 2.5/5 kg', () => {
    assert.deepEqual(Program.calculate531Week(1, 102, UNIT_RULES.kg).map((x) => x.weight), [67.5, 77.5, 87.5]);
    assert.equal(Program.generateBBBSets(102, 0.5, UNIT_RULES.kg)[0].weight, 50);
    assert.equal(Program.incrementFor('Barbell Squat', UNIT_RULES.kg), 5);
    assert.equal(Program.incrementFor('Barbell Bench Press', UNIT_RULES.kg), 2.5);
    assert.equal(Program.incrementFor('Barbell Deadlift', UNIT_RULES.lbs), 10);
    assert.equal(Program.incrementFor('Barbell Overhead Press', UNIT_RULES.lbs), 5);
  });
}

// ---------------------------------------------------------------------------

async function startApp(dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, JWT_SECRET: Buffer.from('test-secret-for-programs').toString('base64'), NODE_ENV: 'test' },
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
  console.log('\n/api/programs: skipping and pausing lifts');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'programs-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));
  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'lifter@test.local', password: 'secret123', username: 'lifter', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);
    const other = await anon('POST', '/auth/register', { email: 'other@test.local', password: 'secret123', username: 'other', units: 'lbs' });
    const callOther = api(app.base, other.body.token);

    const exercises = (await call('GET', '/exercises')).body;
    const list = Array.isArray(exercises) ? exercises : exercises.exercises;
    const idOf = (name) => list.find((e) => e.name === name).id;
    const squat = idOf('Barbell Squat');
    const bench = idOf('Barbell Bench Press');
    const deadlift = idOf('Barbell Deadlift');
    const ohp = idOf('Barbell Overhead Press');
    const lifts531 = [[squat, 300], [bench, 200], [deadlift, 400], [ohp, 120]].map(([exercise_id, training_max]) => ({ exercise_id, training_max }));
    const maxes = async (id) => Object.fromEntries((await call('GET', `/programs/${id}`)).body.lifts.map((l) => [l.exercise_id, l.training_max]));
    const liftIn = async (id, exercise) => (await call('GET', `/programs/${id}/current-week`)).body.lifts.find((l) => l.exercise_id === exercise);

    await test('a skipped 5/3/1 lift keeps its training max at the end of the cycle', async () => {
      const id = (await call('POST', '/programs', { name: 'Injury block', type: '531', lifts: lifts531 })).body.id;
      for (let week = 1; week <= 4; week++) {
        for (const ex of [squat, deadlift]) await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'skipped' });
        for (const ex of [bench, ohp]) {
          await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'completed', ...(week === 3 ? { amrap_reps: 6 } : {}) });
        }
        assert.equal((await call('POST', `/programs/${id}/advance-week`, {})).status, 200);
      }
      const tm = await maxes(id);
      assert.deepEqual([tm[squat], tm[deadlift]], [300, 400]);
      assert.deepEqual([tm[bench], tm[ohp]], [205, 125]);
    });

    await test('a skipped Starting Strength lift keeps its weight', async () => {
      const id = (await call('POST', '/programs', {
        name: 'SS', type: 'starting_strength',
        lifts: [[squat, 200], [bench, 150], [deadlift, 250], [ohp, 95]].map(([exercise_id, training_max]) => ({ exercise_id, training_max })),
      })).body.id;
      await call('PUT', `/programs/${id}/lifts/${squat}/status`, { status: 'skipped' });
      await call('PUT', `/programs/${id}/lifts/${bench}/status`, { status: 'completed' });
      await call('PUT', `/programs/${id}/lifts/${deadlift}/status`, { status: 'skipped' });
      await call('POST', `/programs/${id}/advance-week`, {});
      const w = await maxes(id);
      assert.deepEqual([w[squat], w[deadlift], w[bench]], [200, 250, 155]);
    });

    await test('pausing is validated and limited to the owner', async () => {
      const id = (await call('POST', '/programs', { name: 'Checks', type: '531', lifts: lifts531 })).body.id;
      assert.equal((await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: 'yes' })).status, 400);
      assert.equal((await callOther('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: true })).status, 403);
      assert.equal((await call('PUT', `/programs/${id}/lifts/999999/pause`, { paused: true })).status, 404);
      assert.equal((await call('PUT', '/programs/999999/lifts/1/pause', { paused: true })).status, 404);
    });

    await test('a paused lift is skipped every week until resumed, keeping its training max', async () => {
      const id = (await call('POST', '/programs', { name: 'Pause block', type: '531', lifts: lifts531 })).body.id;
      const paused = await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: true });
      assert.deepEqual(paused.body, { exercise_id: squat, paused: true });
      for (let week = 1; week <= 4; week++) {
        const lift = await liftIn(id, squat);
        assert.deepEqual([lift.paused, lift.status], [true, 'skipped'], `week ${week}`);
        for (const ex of [bench, deadlift, ohp]) {
          await call('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'completed', ...(week === 3 ? { amrap_reps: 6 } : {}) });
        }
        await call('POST', `/programs/${id}/advance-week`, {});
      }
      const tm = await maxes(id);
      assert.equal(tm[squat], 300);
      assert.equal(tm[bench], 205);
      // Still paused in the new cycle; resuming clears this week's automatic skip
      assert.equal((await liftIn(id, squat)).status, 'skipped');
      await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: false });
      const resumed = await liftIn(id, squat);
      assert.deepEqual([resumed.paused, resumed.status], [false, null]);
    });

    await test('pausing keeps a result already recorded, and resuming keeps a skip the user chose', async () => {
      const id = (await call('POST', '/programs', { name: 'Keep results', type: '531', lifts: lifts531 })).body.id;
      await call('PUT', `/programs/${id}/lifts/${squat}/status`, { status: 'completed' });
      await call('PUT', `/programs/${id}/lifts/${squat}/pause`, { paused: true });
      assert.equal((await liftIn(id, squat)).status, 'completed');
      await call('PUT', `/programs/${id}/lifts/${bench}/status`, { status: 'skipped' });
      await call('PUT', `/programs/${id}/lifts/${bench}/pause`, { paused: true });
      await call('PUT', `/programs/${id}/lifts/${bench}/pause`, { paused: false });
      assert.equal((await liftIn(id, bench)).status, 'skipped');
    });

    await test('switching units converts logged weights, templates and training maxes, and back again', async () => {
      const reg2 = await anon('POST', '/auth/register', { email: 'switcher@test.local', password: 'secret123', username: 'switcher', units: 'lbs', bodyweight: 180 });
      const me = api(app.base, reg2.body.token);
      const workout = (await me('POST', '/workouts', { date: '2026-11-02', name: 'Squats', sets: [
        { exercise_id: squat, set_number: 1, reps: 5, weight: 135 },
        { exercise_id: squat, set_number: 2, reps: 5, weight: 225 },
        { exercise_id: squat, set_number: 3, reps: 8, weight: 0 },
      ] })).body.workout;
      const template = (await me('POST', '/templates', { name: 'Leg day' })).body.template;
      await me('POST', `/templates/${template.id}/sets`, { exercise_id: squat, set_number: 1, reps: 5, weight: 185 });
      const program = (await me('POST', '/programs', { name: 'Block', type: '531', lifts: lifts531 })).body.id;

      const weights = async () => (await me('GET', `/workouts/${workout.id}`)).body.workout.sets.map((x) => x.weight);
      const templateWeight = async () => (await me('GET', `/templates/${template.id}`)).body.template.sets[0].weight;
      const tm = async () => (await me('GET', `/programs/${program}`)).body.lifts.find((l) => l.exercise_id === squat).training_max;

      const toKg = await me('PUT', '/profile', { units: 'kg' });
      assert.equal(toKg.status, 200, JSON.stringify(toKg.body));
      assert.equal(toKg.body.user.units, 'kg');
      assert.equal(toKg.body.user.bodyweight, 81.65);
      assert.deepEqual(await weights(), [61.23, 102.06, 0]);
      assert.equal(await templateWeight(), 83.91);
      assert.equal(await tm(), 136.08);

      // Logging bodyweight in other units doesn't switch the user's units
      await me('POST', '/profile/bodyweight', { weight: 200, date: '2026-11-03', units: 'lbs' });
      const after = (await me('GET', '/profile')).body.user;
      assert.equal(after.units, 'kg');
      assert.equal(after.bodyweight, 90.72);

      assert.equal((await me('PUT', '/profile', { units: 'lbs' })).status, 200);
      assert.deepEqual(await weights(), [135, 225, 0], 'back to the original numbers');
      assert.equal(await templateWeight(), 185);
      assert.equal(await tm(), 300);

      // Saving the same units again changes nothing
      await me('PUT', '/profile', { units: 'lbs', username: 'switcher2' });
      assert.deepEqual(await weights(), [135, 225, 0]);
    });

    await test('plate sets keep their own unit; plate maths converts the target', async () => {
      const reg3 = await anon('POST', '/auth/register', { email: 'plates@test.local', password: 'secret123', username: 'plates', units: 'lbs' });
      const me = api(app.base, reg3.body.token);
      const active = (await me('GET', '/plate-presets/active')).body.preset;
      assert.equal(active.units, 'lbs', 'the default set is in the user\'s units');

      const made = await me('POST', '/plate-presets', { name: 'Garage', plates: { 45: 2 }, bar_weight: 45 });
      assert.equal(made.body.preset.units, 'lbs', 'a new set starts in the user\'s units');
      const kgSet = await me('POST', '/plate-presets', { name: 'Hotel', plates: { 20: 2, 10: 2 }, bar_weight: 20, units: 'kg' });
      assert.equal(kgSet.body.preset.units, 'kg');

      // Switching the user to kg leaves the pound plates as they are...
      await me('PUT', '/profile', { units: 'kg' });
      assert.equal((await me('GET', '/plate-presets/active')).body.preset.units, 'lbs');
      assert.equal((await me('GET', '/plate-presets/active')).body.preset.bar_weight, 45);
      // ...and a 61.23 kg target loads a 45 lb plate a side
      const plates = (await me('POST', '/profile/calculate-plates', { target_weight: 61.23 })).body;
      assert.equal(plates.units, 'lbs');
      assert.deepEqual(plates.plates, [45]);
      assert.equal(plates.total, 135);
    });

    await test('a kg lifter\'s program uses kg steps, rounding and bar', async () => {
      const reg4 = await anon('POST', '/auth/register', { email: 'kilo@test.local', password: 'secret123', username: 'kilo', units: 'kg' });
      const me = api(app.base, reg4.body.token);
      const id = (await me('POST', '/programs', { name: 'Kilo', type: '531', lifts: [[squat, 100], [bench, 80], [deadlift, 140], [ohp, 50]].map(([exercise_id, training_max]) => ({ exercise_id, training_max })) })).body.id;
      const week = (await me('GET', `/programs/${id}/current-week`)).body;
      assert.equal(week.units, 'kg');
      assert.equal(week.bar_weight, 20, 'the default kg plate set has a 20 kg bar');
      const ohpLift = week.lifts.find((l) => l.exercise_id === ohp);
      assert.deepEqual(ohpLift.warmup_sets.map((w) => w.weight), [20, 22.5, 25], 'no 45s for a kg lifter');
      assert.equal(ohpLift.increment, 2.5);
      assert.equal(week.lifts.find((l) => l.exercise_id === squat).increment, 5);

      for (let w = 1; w <= 4; w++) {
        for (const ex of [squat, bench, deadlift, ohp]) {
          await me('PUT', `/programs/${id}/lifts/${ex}/status`, { status: 'completed', ...(w === 3 ? { amrap_reps: 6 } : {}) });
        }
        await me('POST', `/programs/${id}/advance-week`, {});
      }
      const tm = Object.fromEntries((await me('GET', `/programs/${id}`)).body.lifts.map((l) => [l.exercise_id, l.training_max]));
      assert.deepEqual([tm[squat], tm[bench], tm[deadlift], tm[ohp]], [105, 82.5, 145, 52.5]);
    });

    await test('unit conversion rounds to plate-friendly numbers both ways', () => {
      for (const lbs of [45, 95, 135, 137.5, 185, 225, 315, 405, 2.5]) {
        assert.equal(convertWeight(convertWeight(lbs, 'lbs', 'kg'), 'kg', 'lbs'), lbs, `${lbs} lbs`);
      }
      for (const kg of [20, 60, 61.25, 100, 102.5, 140, 1.25]) {
        assert.equal(convertWeight(convertWeight(kg, 'kg', 'lbs'), 'lbs', 'kg'), kg, `${kg} kg`);
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
console.log(failures ? `\n${failures} test(s) failed` : '\nAll program tests passed');
process.exit(failures ? 1 : 0);
