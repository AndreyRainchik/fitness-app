/**
 * The run session library: what a plan can schedule, as data.
 *
 * See docs/plans/run-sessions.md for the coaching behind it. Each quality
 * session belongs to a family and has levels, smallest first; a plan moves
 * a family up one level each time it uses it, one variable at a time.
 *
 * Steps (what the athlete runs), all distances in metres and times in seconds:
 *   { kind: 'warmup' | 'cooldown' | 'run', zone, distance_m? | duration_s? }
 *   { kind: 'repeat', reps: [{ parts: [{ zone, distance_m? | duration_s? }] }],
 *     recovery: { kind: 'jog' | 'float' | 'walk' | 'none', duration_s? | distance_m? } }
 *   { kind: 'strides', count, duration_s }   (with walk-back recovery)
 *
 * Template fields:
 *   slot      'A' speed/strength, 'B' threshold/race-specific, 'long', 'easy', 'race'
 *   phases    where it's used: base, build, peak, taper, cutback, maintain
 *   races     weighting per race (0 = never), plus `maintain`
 *   legStress 'low' | 'medium' | 'high': how much it competes with heavy leg lifting
 *   warmup    whether warm-up and cool-down are added (and strides in the warm-up for fast sessions)
 *   levels    functions ctx -> main steps; ctx = { mile, race, distance_m (long/easy only) }
 */

const min = (n) => n * 60;

const run = (zone, amount) => ({ kind: 'run', zone, ...amount });
const rep = (...parts) => ({ parts });
const repeat = (count, parts, recovery) => ({ kind: 'repeat', reps: Array.from({ length: count }, () => rep(...parts)), recovery });
const ladder = (reps, recovery) => ({ kind: 'repeat', reps: reps.map((parts) => rep(...parts)), recovery });
const jog = (seconds) => ({ kind: 'jog', duration_s: seconds });
const jogDistance = (meters) => ({ kind: 'jog', distance_m: meters });
const float = (amount) => ({ kind: 'float', ...amount });
const walk = (seconds) => ({ kind: 'walk', duration_s: seconds });
const NONE = { kind: 'none' };
const strides = (count = 6) => ({ kind: 'strides', count, duration_s: 20 });
const d = (meters) => ({ distance_m: meters });
const t = (seconds) => ({ duration_s: seconds });

/** The race's own pace zone: goal pace if the athlete set one, else the predicted race pace. */
const racePaceZone = (ctx) => (ctx.hasGoal ? 'goal' : ({ '5k': '5k', '10k': '10k', half: 'half', marathon: 'marathon' }[ctx.race] ?? 'threshold'));

const ALL = { '5k': 1, '10k': 1, half: 1, marathon: 1, maintain: 1 };

export const SESSIONS = [
  // ---- Slot A: speed and strength -------------------------------------
  {
    id: 'fartlek', family: 'fartlek', slot: 'A', name: 'Fartlek',
    purpose: 'Speed play: faster running without the pressure of exact splits.',
    cue: 'Hard means 5K–10K effort; the easy bits are genuinely easy.',
    phases: ['base', 'cutback', 'maintain'], races: { '5k': 3, '10k': 3, half: 2, marathon: 2, maintain: 3 }, legStress: 'medium', warmup: true,
    levels: [
      () => [repeat(8, [{ zone: '10k', ...t(60) }], jog(60))],
      () => [ladder([[{ zone: '10k', ...t(60) }], [{ zone: '10k', ...t(120) }], [{ zone: '10k', ...t(180) }], [{ zone: '10k', ...t(120) }], [{ zone: '10k', ...t(60) }]], jog(60))],
      () => [repeat(10, [{ zone: '5k', ...t(30) }], jog(90))],
      () => [repeat(6, [{ zone: '10k', ...t(120) }], jog(60))],
    ],
  },
  {
    id: 'hill_sprints', family: 'hills', slot: 'A', name: 'Easy run + hill sprints',
    purpose: 'Short, steep sprints build power and stiffer, more resilient legs at almost no aerobic cost.',
    cue: 'Steep hill, near-maximal but smooth. Walk all the way down.',
    phases: ['base', 'maintain'], races: { '5k': 2, '10k': 2, half: 2, marathon: 1, maintain: 2 }, legStress: 'high', warmup: false,
    levels: [
      () => [run('easy', t(min(30))), repeat(6, [{ zone: 'effort', ...t(10) }], walk(90))],
      () => [run('easy', t(min(35))), repeat(8, [{ zone: 'effort', ...t(10) }], walk(90))],
      () => [run('easy', t(min(35))), repeat(10, [{ zone: 'effort', ...t(10) }], walk(90))],
    ],
  },
  {
    id: 'hill_repeats', family: 'hills', slot: 'A', name: 'Hill repeats',
    purpose: 'Strength-endurance: running uphill at effort builds the power to hold pace late in a race.',
    cue: '5K effort going up, tall posture, drive the arms. Jog down easy.',
    phases: ['base', 'build', 'maintain'], races: { '5k': 3, '10k': 3, half: 3, marathon: 2, maintain: 3 }, legStress: 'high', warmup: true,
    levels: [
      () => [repeat(6, [{ zone: 'effort', ...t(60) }], jog(90))],
      () => [repeat(8, [{ zone: 'effort', ...t(60) }], jog(90))],
      () => [repeat(6, [{ zone: 'effort', ...t(90) }], jog(120))],
      () => [repeat(8, [{ zone: 'effort', ...t(90) }], jog(120))],
    ],
  },
  {
    id: 'long_hills', family: 'hills', slot: 'A', name: 'Long hills',
    purpose: 'Longer climbs at a strong effort: strength for the later miles of a half or marathon.',
    cue: '10K-to-half effort; stay strong over the top.',
    phases: ['base'], races: { '5k': 0, '10k': 1, half: 2, marathon: 3, maintain: 1 }, legStress: 'high', warmup: true,
    levels: [
      () => [repeat(4, [{ zone: 'effort', ...t(180) }], jog(180))],
      () => [repeat(5, [{ zone: 'effort', ...t(180) }], jog(180))],
    ],
  },
  {
    id: 'reps', family: 'reps', slot: 'A', name: 'Repetitions',
    purpose: 'Speed and running economy: short, fast reps with full recovery so form stays good.',
    cue: 'Fast and relaxed. If form breaks, slow down; this is not a sprint.',
    phases: ['base', 'build', 'cutback', 'maintain'], races: { '5k': 3, '10k': 2, half: 1, marathon: 1, maintain: 2 }, legStress: 'high', warmup: true,
    levels: [
      () => [repeat(8, [{ zone: 'rep', ...d(200) }], jogDistance(200))],
      () => [repeat(10, [{ zone: 'rep', ...d(200) }], jogDistance(200))],
      () => [repeat(6, [{ zone: 'rep', ...d(400) }], jogDistance(400))],
      () => [repeat(8, [{ zone: 'rep', ...d(400) }], jogDistance(400))],
    ],
  },
  {
    id: 'rolling', family: 'rolling', slot: 'A', name: 'Rolling intervals',
    purpose: 'Recoveries are run, not jogged, so you build speed and aerobic strength together.',
    cue: 'The floats are steady running. Keep moving; never stop.',
    phases: ['build', 'peak', 'maintain'], races: { '5k': 2, '10k': 3, half: 3, marathon: 2, maintain: 3 }, legStress: 'medium', warmup: true,
    levels: [
      () => [repeat(6, [{ zone: '10k', ...t(180) }], float(t(120)))],
      () => [repeat(8, [{ zone: 'interval', ...t(120) }], float(t(60)))],
      () => [repeat(5, [{ zone: 'threshold', ...t(300) }], float(t(120)))],
      () => [repeat(6, [{ zone: 'threshold', ...t(300) }], float(t(90)))],
    ],
  },
  {
    id: 'intervals', family: 'vo2', slot: 'A', name: 'Intervals',
    purpose: 'Raises your VO2max, the ceiling on how fast you can run aerobically.',
    cue: 'Even splits; the last rep should match the first.',
    phases: ['build', 'peak', 'taper', 'maintain'], races: { '5k': 3, '10k': 3, half: 2, marathon: 1, maintain: 3 }, legStress: 'medium', warmup: true,
    levels: [
      () => [repeat(5, [{ zone: 'interval', ...d(800) }], jog(120))],
      () => [repeat(3, [{ zone: 'interval', ...d(1200) }], jog(180))],
      () => [repeat(5, [{ zone: 'interval', ...d(1000) }], jog(150))],
      () => [repeat(6, [{ zone: 'interval', ...d(800) }], jog(120))],
      () => [repeat(4, [{ zone: 'interval', ...d(1200) }], jog(180))],
      () => [repeat(6, [{ zone: 'interval', ...d(1000) }], jog(150))],
    ],
  },
  {
    id: 'mile_repeats', family: 'vo2', slot: 'A', name: 'Mile repeats',
    purpose: 'Long reps between 10K pace and threshold: strength to hold a hard pace for longer.',
    cue: 'Settle into the pace in the first 200 m and hold it.',
    phases: ['peak'], races: { '5k': 1, '10k': 3, half: 3, marathon: 1, maintain: 1 }, legStress: 'medium', warmup: true,
    levels: [
      (ctx) => [repeat(3, [{ zone: '10k', ...d(ctx.mile) }], jog(120))],
      (ctx) => [repeat(4, [{ zone: '10k', ...d(ctx.mile) }], jog(120))],
    ],
  },
  {
    id: 'pyramid', family: 'pyramid', slot: 'A', name: 'Pyramid',
    purpose: 'Changing rep lengths keeps a hard VO2 session fresh and teaches you to switch gears.',
    cue: 'Same effort all the way: the long reps are not slower in spirit.',
    phases: ['build', 'peak', 'maintain'], races: { '5k': 3, '10k': 3, half: 2, marathon: 1, maintain: 2 }, legStress: 'medium', warmup: true,
    levels: [
      () => [ladder([400, 800, 1200, 800, 400].map((m) => [{ zone: 'interval', ...d(m) }]), jog(90))],
      () => [ladder([
        [{ zone: '10k', ...d(1600) }], [{ zone: '5k', ...d(1200) }], [{ zone: 'interval', ...d(800) }], [{ zone: 'rep', ...d(400) }],
      ], jog(120))],
    ],
  },

  // ---- Slot B: threshold and race-specific ----------------------------
  {
    id: 'progression', family: 'progression', slot: 'B', name: 'Progression run',
    purpose: 'Teaches pacing discipline and finishing strong on tired legs.',
    cue: 'Each third a little quicker; the first third should feel almost too easy.',
    phases: ['base', 'build', 'maintain'], races: ALL, legStress: 'low', warmup: false,
    levels: [
      () => [run('easy', t(min(15))), run('steady', t(min(15))), run('marathon', t(min(10)))],
      () => [run('easy', t(min(15))), run('steady', t(min(15))), run('marathon', t(min(15)))],
      () => [run('easy', t(min(15))), run('marathon', t(min(15))), run('threshold', t(min(10)))],
      () => [run('easy', t(min(20))), run('marathon', t(min(15))), run('threshold', t(min(10)))],
    ],
  },
  {
    id: 'steady', family: 'steady', slot: 'B', name: 'Steady run',
    purpose: 'Aerobic strength: faster than easy, well below threshold.',
    cue: 'Purposeful but relaxed; you could talk in short sentences.',
    phases: ['base', 'maintain'], races: { '5k': 1, '10k': 2, half: 3, marathon: 3, maintain: 2 }, legStress: 'low', warmup: false,
    levels: [
      () => [run('easy', t(min(10))), run('steady', t(min(25))), run('easy', t(min(5)))],
      () => [run('easy', t(min(10))), run('steady', t(min(35))), run('easy', t(min(5)))],
      () => [run('easy', t(min(10))), run('steady', t(min(45))), run('easy', t(min(5)))],
    ],
  },
  {
    id: 'tempo', family: 'threshold', slot: 'B', name: 'Tempo run',
    purpose: 'Raises your lactate threshold, the pace you can hold for about an hour.',
    cue: 'Comfortably hard. You should finish feeling you could do 5 more minutes.',
    phases: ['base', 'build', 'peak', 'taper', 'maintain'], races: { '5k': 2, '10k': 3, half: 3, marathon: 3, maintain: 3 }, legStress: 'medium', warmup: true,
    levels: [
      () => [repeat(2, [{ zone: 'threshold', ...t(min(10)) }], jog(120))],
      () => [run('threshold', t(min(20)))],
      () => [repeat(2, [{ zone: 'threshold', ...t(min(12)) }], jog(120))],
      () => [run('threshold', t(min(25)))],
      () => [repeat(2, [{ zone: 'threshold', ...t(min(15)) }], jog(120))],
      () => [run('threshold', t(min(30)))],
    ],
  },
  {
    id: 'cruise', family: 'threshold', slot: 'B', name: 'Cruise intervals',
    purpose: 'More time at threshold than a continuous tempo, thanks to short recoveries.',
    cue: 'Recoveries are short on purpose; start the next rep before you feel fully ready.',
    phases: ['build', 'peak', 'maintain'], races: { '5k': 2, '10k': 3, half: 3, marathon: 3, maintain: 3 }, legStress: 'medium', warmup: true,
    levels: [
      (ctx) => [repeat(3, [{ zone: 'threshold', ...d(ctx.mile) }], jog(60))],
      (ctx) => [repeat(4, [{ zone: 'threshold', ...d(ctx.mile) }], jog(60))],
      (ctx) => [repeat(5, [{ zone: 'threshold', ...d(ctx.mile) }], jog(60))],
      (ctx) => [repeat(3, [{ zone: 'threshold', ...d(2 * ctx.mile) }], jog(90))],
    ],
  },
  {
    id: 'over_unders', family: 'over_unders', slot: 'B', name: 'Over/unders',
    purpose: 'Teaches your body to clear lactate while still running hard.',
    cue: 'Stay relaxed on the unders; they are not recovery.',
    phases: ['build', 'peak', 'maintain'], races: { '5k': 1, '10k': 3, half: 3, marathon: 2, maintain: 2 }, legStress: 'medium', warmup: true,
    levels: [
      () => [repeat(4, [{ zone: '10k', ...t(120) }, { zone: 'half', ...t(180) }], NONE)],
      () => [repeat(4, [{ zone: '10k', ...t(180) }, { zone: 'half', ...t(180) }], NONE)],
      () => [repeat(5, [{ zone: '10k', ...t(180) }, { zone: 'half', ...t(120) }], NONE)],
      () => [repeat(3, [{ zone: '10k', ...d(1000) }, { zone: 'half', ...d(1000) }], NONE)],
    ],
  },
  {
    id: 'cutdown', family: 'cutdown', slot: 'B', name: 'Cutdown',
    purpose: 'Each rep a little faster, so the quickest running comes when you are most tired.',
    cue: 'Be patient early; the first rep should feel controlled.',
    phases: ['build', 'peak'], races: { '5k': 2, '10k': 3, half: 2, marathon: 1, maintain: 1 }, legStress: 'medium', warmup: true,
    levels: [
      () => [ladder(['threshold', 'threshold', '10k', '10k', 'interval'].map((zone) => [{ zone, ...d(1000) }]), jog(90))],
      () => [ladder(['threshold', 'threshold', '10k', '10k', '5k', 'interval'].map((zone) => [{ zone, ...d(1000) }]), jog(90))],
    ],
  },
  {
    id: 'race_blocks', family: 'race_specific', slot: 'B', name: 'Race-pace blocks',
    purpose: 'Long blocks at race pace so goal pace starts to feel familiar.',
    cue: 'Lock onto the pace; resist going faster than target.',
    phases: ['peak', 'taper'], races: { '5k': 3, '10k': 3, half: 3, marathon: 2, maintain: 0 }, legStress: 'medium', warmup: true,
    levels: [
      (ctx) => blocksFor(ctx, 0),
      (ctx) => blocksFor(ctx, 1),
      (ctx) => blocksFor(ctx, 2),
    ],
  },
  {
    id: 'time_trial', family: 'benchmark', slot: 'B', name: '5K time trial',
    purpose: 'A benchmark: your result updates your paces for the rest of the plan.',
    cue: 'A parkrun or a flat solo 5K. Start controlled, finish hard.',
    phases: ['cutback'], races: ALL, legStress: 'medium', warmup: true, benchmark: true,
    levels: [() => [run('5k', d(5000))]],
  },

  // ---- Long runs ----------------------------------------------------------
  {
    id: 'long_easy', family: 'long', slot: 'long', name: 'Long run',
    purpose: 'Aerobic endurance: the foundation of every race distance.',
    cue: 'Easy the whole way. Slower is fine.',
    phases: ['base', 'build', 'peak', 'taper', 'cutback', 'maintain'], races: ALL, legStress: 'low',
    levels: [(ctx) => [run('easy', d(ctx.distance_m))]],
  },
  {
    id: 'long_fast_finish', family: 'long', slot: 'long', name: 'Long run, fast finish',
    purpose: 'Running quicker on tired legs, like the end of a race.',
    cue: 'Easy until the final stretch, then pick it up smoothly.',
    phases: ['base', 'build', 'peak', 'maintain'], races: ALL, legStress: 'low', quality: true,
    levels: [(ctx) => {
      const zone = ctx.race === 'marathon' ? 'marathon' : ctx.race === 'half' ? 'half' : 'threshold';
      const finish = Math.min(ctx.distance_m * 0.25, zone === 'threshold' ? 3000 : 5000);
      return [run('easy', d(ctx.distance_m - finish)), run(zone, d(finish))];
    }],
  },
  {
    id: 'long_progression', family: 'long', slot: 'long', name: 'Progression long run',
    purpose: 'Builds endurance and pace control: each third a little quicker.',
    cue: 'Start slower than you want to.',
    phases: ['build', 'peak', 'maintain'], races: { '5k': 1, '10k': 2, half: 3, marathon: 3, maintain: 2 }, legStress: 'low', quality: true,
    levels: [(ctx) => [run('easy', d(ctx.distance_m / 3)), run('steady', d(ctx.distance_m / 3)), run('marathon', d(ctx.distance_m / 3))]],
  },
  {
    id: 'long_surges', family: 'long', slot: 'long', name: 'Long run with surges',
    purpose: 'Short surges keep the legs lively over a long, mostly easy run.',
    cue: 'Surges at half-marathon effort, then settle straight back to easy.',
    phases: ['base', 'build'], races: { '5k': 2, '10k': 2, half: 2, marathon: 1, maintain: 2 }, legStress: 'low', quality: true,
    levels: [(ctx) => {
      const surges = 6;
      const share = ctx.distance_m / (surges + 1);
      return [ladder(Array.from({ length: surges }, () => [{ zone: 'easy', ...d(share - 250) }, { zone: 'half', ...t(60) }]), NONE), run('easy', d(share))];
    }],
  },
  {
    id: 'long_race_pace', family: 'long', slot: 'long', name: 'Long run with race pace',
    purpose: 'The most race-specific session: goal pace on tired legs.',
    cue: 'Hit the pace, not faster. Practise your race-day fuelling.',
    phases: ['peak'], races: { '5k': 0, '10k': 0, half: 3, marathon: 3, maintain: 0 }, legStress: 'low', quality: true,
    levels: [
      (ctx) => longRacePace(ctx, 0),
      (ctx) => longRacePace(ctx, 1),
      (ctx) => longRacePace(ctx, 2),
    ],
  },

  // ---- Easy days ----------------------------------------------------------
  {
    id: 'easy', family: 'easy', slot: 'easy', name: 'Easy run',
    purpose: 'Aerobic base and recovery. Most of your running.', cue: 'Conversational the whole way.',
    phases: ['base', 'build', 'peak', 'taper', 'cutback', 'maintain'], races: ALL, legStress: 'low',
    levels: [(ctx) => [run('easy', d(ctx.distance_m))]],
  },
  {
    id: 'easy_strides', family: 'easy', slot: 'easy', name: 'Easy run + strides',
    purpose: 'Easy running plus a few strides for leg speed and form, at almost no cost.',
    cue: 'Strides are quick and relaxed; walk back to full recovery.',
    phases: ['base', 'build', 'peak', 'taper', 'cutback', 'maintain'], races: ALL, legStress: 'low',
    levels: [(ctx) => [run('easy', d(ctx.distance_m - 400)), strides(6)]],
  },
  {
    id: 'recovery', family: 'easy', slot: 'easy', name: 'Recovery run',
    purpose: 'Short and very easy: blood flow without fatigue.', cue: 'Slower than you think. Short on purpose.',
    phases: ['base', 'build', 'peak', 'taper', 'cutback', 'maintain'], races: ALL, legStress: 'low',
    levels: [(ctx) => [run('recovery', d(ctx.distance_m))]],
  },

  // ---- Race week ----------------------------------------------------------
  {
    id: 'sharpener', family: 'sharpener', slot: 'A', name: 'Race-week sharpener',
    purpose: 'Short, crisp race-pace running to feel sharp without adding fatigue.',
    cue: 'Smooth and controlled. You should finish wanting more.',
    phases: ['race'], races: ALL, legStress: 'low', warmup: true,
    levels: [(ctx) => [repeat(5, [{ zone: racePaceZone(ctx), ...t(60) }], jog(120))]],
  },
  {
    id: 'shakeout', family: 'easy', slot: 'easy', name: 'Shakeout',
    purpose: 'Loosen up the day before. Nothing more.', cue: 'Very easy, a few strides at the end.',
    phases: ['race'], races: ALL, legStress: 'low',
    levels: [() => [run('easy', t(min(18))), strides(4)]],
  },
  {
    id: 'race', family: 'race', slot: 'race', name: 'Race day',
    purpose: 'The day it all comes together.', cue: 'Start a touch conservative; negative split if you can.',
    phases: ['race'], races: ALL, legStress: 'low',
    levels: [(ctx) => [run(racePaceZone(ctx), d(ctx.race_m))]],
  },
];

function blocksFor(ctx, level) {
  const zone = racePaceZone(ctx);
  const mile = ctx.mile;
  const table = {
    '5k': [repeat(5, [{ zone, ...d(1000) }], jog(90)), repeat(4, [{ zone, ...d(1200) }], jog(120)), repeat(3, [{ zone, ...d(1600) }], jog(150))],
    '10k': [repeat(3, [{ zone, ...d(2000) }], jog(120)), repeat(4, [{ zone, ...d(2000) }], jog(120)), repeat(2, [{ zone, ...d(3000) }], jog(180))],
    half: [repeat(3, [{ zone, ...d(2 * mile) }], float(d(mile / 2))), repeat(2, [{ zone, ...d(3 * mile) }], float(d(mile / 2))), repeat(2, [{ zone, ...d(4 * mile) }], float(d(mile)))],
    marathon: [repeat(3, [{ zone, ...d(2 * mile) }], float(d(mile))), repeat(3, [{ zone, ...d(3 * mile) }], float(d(mile))), repeat(2, [{ zone, ...d(5 * mile) }], float(d(mile)))],
  };
  const options = table[ctx.race] ?? table.half;
  return [options[Math.min(level, options.length - 1)]];
}

function longRacePace(ctx, level) {
  const zone = racePaceZone(ctx);
  const total = ctx.distance_m;
  const share = ctx.race === 'marathon' ? [0.35, 0.45, 0.55][level] : [0.25, 0.3, 0.35][level];
  const fast = total * share;
  if (level === 1) {
    // Two blocks inside the run, easy between
    const block = fast / 2;
    const easy = (total - fast) / 3;
    return [run('easy', d(easy)), run(zone, d(block)), run('easy', d(easy)), run(zone, d(block)), run('easy', d(easy))];
  }
  return [run('easy', d(total - fast)), run(zone, d(fast))];
}

export const sessionById = (id) => SESSIONS.find((s) => s.id === id);
