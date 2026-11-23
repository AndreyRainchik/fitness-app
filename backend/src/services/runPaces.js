/**
 * Training pace zones from a VDOT (Jack Daniels' running formula).
 *
 * Paces are seconds per km. A zone is a range { fast, slow }: `fast` is the
 * quicker end (fewer seconds per km).
 *
 * Easy, steady, threshold, interval and repetition paces are the speed at
 * which running costs a given share of VO2max (the VDOT), solving Daniels'
 * oxygen-cost curve; the shares are calibrated against his published tables
 * (VDOT 50: threshold 4:15 /km, interval 3:55 /km, repetition ~3:40 /km,
 * easy 5:07–5:40 /km). Race paces (marathon, half, 10K, 5K) come from the
 * race-time predictions the app already uses.
 */

import { predictTime } from './cardioAnalysis.js';

/** Metres per minute at which running costs `share` of the VDOT. */
function speedAtShare(vdot, share) {
  // Daniels: VO2 = -4.60 + 0.182258 v + 0.000104 v^2  (v in m/min)
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - share * vdot;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

const paceAtShare = (vdot, share) => 60000 / speedAtShare(vdot, share);
const racePace = (vdot, meters) => predictTime(vdot, meters) / (meters / 1000);

export const RACE_DISTANCES = {
  '5k': { label: '5K', meters: 5000 },
  '10k': { label: '10K', meters: 10000 },
  half: { label: 'Half marathon', meters: 21097.5 },
  marathon: { label: 'Marathon', meters: 42195 },
};

/** Zones in the order they're shown, slowest first. */
export const ZONES = [
  { id: 'recovery', label: 'Recovery', feel: 'Very easy, full conversation' },
  { id: 'easy', label: 'Easy', feel: 'Conversational' },
  { id: 'steady', label: 'Steady', feel: 'Comfortable but purposeful' },
  { id: 'float', label: 'Float', feel: 'Moving recovery: easy-steady, keep it rolling' },
  { id: 'marathon', label: 'Marathon pace', feel: 'Controlled; could hold it for hours' },
  { id: 'half', label: 'Half marathon pace', feel: 'Comfortably hard' },
  { id: 'threshold', label: 'Threshold', feel: 'Comfortably hard, short sentences' },
  { id: '10k', label: '10K pace', feel: 'Hard but controlled' },
  { id: '5k', label: '5K pace', feel: 'Hard' },
  { id: 'interval', label: 'Interval', feel: 'Hard, a few words at most' },
  { id: 'rep', label: 'Repetition', feel: 'Fast and relaxed, not a sprint' },
  { id: 'goal', label: 'Goal race pace', feel: 'Your target pace for race day' },
  { id: 'effort', label: 'By effort', feel: 'Run by feel; pace means little on hills' },
];

const around = (pace, spread) => ({ fast: Math.round(pace - spread), slow: Math.round(pace + spread) });

/**
 * Every zone's pace range for a VDOT: { [zone]: { fast, slow } } in s/km.
 * `goalPace` (s/km) adds the goal zone; 'effort' has no pace.
 */
export function paceZones(vdot, { goalPace = null } = {}) {
  const easy = { fast: Math.round(paceAtShare(vdot, 0.70)), slow: Math.round(paceAtShare(vdot, 0.62)) };
  const marathon = racePace(vdot, 42195);
  const zones = {
    recovery: { fast: easy.slow, slow: Math.round(easy.slow + 30) },
    easy,
    steady: around(paceAtShare(vdot, 0.765), 6),
    float: around((marathon + easy.fast) / 2, 10),
    marathon: around(marathon, 3),
    half: around(racePace(vdot, 21097.5), 2),
    threshold: around(paceAtShare(vdot, 0.88), 2),
    '10k': around(racePace(vdot, 10000), 1.5),
    '5k': around(racePace(vdot, 5000), 1.5),
    interval: around(paceAtShare(vdot, 0.975), 1.5),
    rep: around(paceAtShare(vdot, 1.06), 1.5),
    effort: null,
  };
  if (goalPace > 0) zones.goal = around(goalPace, 2);
  return zones;
}

/** A representative pace (s/km) for working out how far a timed step goes. */
export function typicalPace(zones, zone) {
  const range = zones[zone] ?? null;
  if (range) return (range.fast + range.slow) / 2;
  // By-effort steps (hills) cover ground at about threshold speed going up and easy pace coming down
  return zone === 'effort' ? zones.threshold.slow + 20 : (zones.easy.fast + zones.easy.slow) / 2;
}
