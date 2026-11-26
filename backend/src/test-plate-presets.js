/**
 * Tests for per-exercise plate sets (/api/plate-presets/assignments).
 *
 * Starts the app on a throwaway database and checks that an exercise can be
 * given its own plate set, that each user's choices are their own, and that
 * deleting a plate set sends its exercises back to the active set.
 *
 * Run: npm run test:plates (from backend/)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

async function startApp(dbPath) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, JWT_SECRET: Buffer.from('test-secret-for-plates').toString('base64'), NODE_ENV: 'test' },
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

async function main() {
  console.log('\n/api/plate-presets/assignments: a plate set per exercise');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plates-test-'));
  const app = await startApp(path.join(tmp, 'test.db'));
  try {
    const anon = api(app.base);
    const reg = await anon('POST', '/auth/register', { email: 'lifter@test.local', password: 'secret123', username: 'lifter', units: 'lbs' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const call = api(app.base, reg.body.token);
    const other = await anon('POST', '/auth/register', { email: 'other@test.local', password: 'secret123', username: 'other', units: 'kg' });
    const callOther = api(app.base, other.body.token);

    const exercises = (await call('GET', '/exercises')).body;
    const list = exercises.exercises || exercises;
    const bench = list.find((e) => e.name === 'Barbell Bench Press');
    const ohp = list.find((e) => e.name === 'Barbell Overhead Press');
    const active = (await call('GET', '/plate-presets/active')).body.preset;
    const home = (await call('POST', '/plate-presets', { name: 'Home', plates: { '20': 2, '10': 2, '5': 2, '2.5': 2 }, bar_weight: 15, units: 'kg' })).body.preset;

    await test('no choices at first: every exercise uses the active set', async () => {
      const r = await call('GET', '/plate-presets/assignments');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.assignments, []);
    });

    await test('an exercise can be given its own plate set, which keeps its unit', async () => {
      const r = await call('PUT', `/plate-presets/assignments/${ohp.id}`, { preset_id: home.id });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.preset.id, home.id);
      assert.equal(r.body.preset.units, 'kg');
      const { assignments } = (await call('GET', '/plate-presets/assignments')).body;
      assert.deepEqual(assignments.map((a) => [a.exercise_id, a.preset_id, a.preset_name]), [[ohp.id, home.id, 'Home']]);
    });

    await test('choosing again replaces the choice; null goes back to the active set', async () => {
      await call('PUT', `/plate-presets/assignments/${bench.id}`, { preset_id: home.id });
      await call('PUT', `/plate-presets/assignments/${bench.id}`, { preset_id: active.id });
      let { assignments } = (await call('GET', '/plate-presets/assignments')).body;
      assert.equal(assignments.find((a) => a.exercise_id === bench.id).preset_id, active.id);
      const r = await call('PUT', `/plate-presets/assignments/${bench.id}`, { preset_id: null });
      assert.equal(r.status, 200);
      assert.equal(r.body.preset.id, active.id);
      ({ assignments } = (await call('GET', '/plate-presets/assignments')).body);
      assert.equal(assignments.some((a) => a.exercise_id === bench.id), false);
    });

    await test('another user\'s plate set or a missing exercise is refused', async () => {
      const theirs = (await callOther('GET', '/plate-presets/active')).body.preset;
      assert.equal((await call('PUT', `/plate-presets/assignments/${bench.id}`, { preset_id: theirs.id })).status, 404);
      assert.equal((await call('PUT', '/plate-presets/assignments/999999', { preset_id: home.id })).status, 404);
      assert.equal((await call('PUT', `/plate-presets/assignments/${bench.id}`, { preset_id: 'x' })).status, 400);
    });

    await test('each user\'s choices are their own, even on shared exercises', async () => {
      const { assignments } = (await callOther('GET', '/plate-presets/assignments')).body;
      assert.deepEqual(assignments, []);
    });

    await test('deleting a plate set sends its exercises back to the active set', async () => {
      assert.equal((await call('DELETE', `/plate-presets/${home.id}`)).status, 200);
      const { assignments } = (await call('GET', '/plate-presets/assignments')).body;
      assert.deepEqual(assignments, []);
    });
  } finally {
    app.child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

await main().catch((error) => {
  failures += 1;
  console.error(error);
});
console.log(failures ? `\n${failures} failed` : '\nAll passed');
process.exit(failures ? 1 : 0);
