/**
 * Showing run plan steps and paces. Steps and zones come from the backend
 * (services/runSessions.js and runPaces.js): distances in metres, times in
 * seconds, paces in seconds per km.
 */
import { formatClock } from './cardio';

const MILE = 1609.344;

export const ZONE_LABELS = {
  recovery: 'recovery',
  easy: 'easy',
  steady: 'steady',
  float: 'float',
  marathon: 'marathon pace',
  half: 'half marathon pace',
  threshold: 'threshold',
  '10k': '10K pace',
  '5k': '5K pace',
  interval: 'interval pace',
  rep: 'repetition pace',
  goal: 'goal pace',
  effort: 'hard effort',
};

/** Tailwind classes for a zone chip: easy greys and blues up to reds for fast work. */
export const ZONE_TONES = {
  recovery: 'bg-gray-100 text-gray-600',
  easy: 'bg-gray-100 text-gray-700',
  steady: 'bg-primary-50 text-primary-700',
  float: 'bg-primary-50 text-primary-700',
  marathon: 'bg-teal-50 text-teal-700',
  half: 'bg-success-50 text-success-700',
  threshold: 'bg-warning-50 text-warning-700',
  '10k': 'bg-orange-50 text-orange-700',
  '5k': 'bg-orange-50 text-orange-700',
  interval: 'bg-danger-50 text-danger-700',
  rep: 'bg-pink-50 text-pink-700',
  goal: 'bg-purple-50 text-purple-700',
  effort: 'bg-danger-50 text-danger-700',
};

const perUnit = (secondsPerKm, unit) => (unit === 'mi' ? secondsPerKm * (MILE / 1000) : secondsPerKm);

/** "7:27–7:33 /mi", or null for by-effort zones. */
export function paceRange(zones, zone, unit) {
  const range = zones?.[zone];
  if (!range) return null;
  const fast = formatClock(perUnit(range.fast, unit));
  const slow = formatClock(perUnit(range.slow, unit));
  return `${fast === slow ? fast : `${fast}–${slow}`} /${unit}`;
}

/** "3:26–3:30" for running `meters` in a zone. */
export function splitRange(zones, zone, meters) {
  const range = zones?.[zone];
  if (!range || !meters) return null;
  const fast = formatClock((range.fast * meters) / 1000);
  const slow = formatClock((range.slow * meters) / 1000);
  return fast === slow ? fast : `${fast}–${slow}`;
}

const isMiles = (meters) => Math.abs(meters / MILE - Math.round(meters / MILE)) < 0.02 && meters >= MILE * 0.98;

/** "800 m", "1 mi", "1.6 km", "3.5 mi" */
export function formatAmount(amount, unit) {
  if (amount.duration_s) {
    const s = amount.duration_s;
    if (s < 60) return `${s} s`;
    if (s % 60 === 0) return `${s / 60} min`;
    return formatClock(s);
  }
  const m = amount.distance_m ?? 0;
  if (unit === 'mi' && isMiles(m)) return `${Math.round(m / MILE)} mi`;
  if (m < 2000 && Math.abs(m - Math.round(m / 100) * 100) < 1) return `${Math.round(m)} m`;
  const value = unit === 'mi' ? m / MILE : m / 1000;
  return `${Number.isInteger(Math.round(value * 10) / 10) ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

/** Total distance: "6.2 mi" */
export function formatPlanDistance(meters, unit, digits = 1) {
  const value = unit === 'mi' ? meters / MILE : meters / 1000;
  return `${value.toFixed(digits)} ${unit}`;
}

function recoveryText(recovery, unit) {
  if (!recovery || recovery.kind === 'none') return 'no rest between';
  const amount = formatAmount(recovery, unit);
  return { jog: `${amount} jog between`, float: `${amount} float between`, walk: `${amount} walk between` }[recovery.kind] ?? amount;
}

const sameParts = (a, b) => JSON.stringify(a.parts) === JSON.stringify(b.parts);

/**
 * One step as { title, detail, zones: [zone] } for display.
 *   warm-up:  "Warm-up", "1 mi easy · 9:10–9:50 /mi"
 *   repeat:   "6 × 800 m", "interval pace · 3:26–3:30 each (6:55–7:01 /mi) · 2 min jog between"
 */
export function describeStep(step, zones, unit) {
  const label = (zone) => ZONE_LABELS[zone] ?? zone;
  const pace = (zone) => paceRange(zones, zone, unit);

  if (step.kind === 'warmup' || step.kind === 'cooldown') {
    return {
      title: step.kind === 'warmup' ? 'Warm-up' : 'Cool-down',
      detail: [`${formatAmount(step, unit)} ${label(step.zone)}`, pace(step.zone)].filter(Boolean).join(' · '),
      zones: [step.zone],
    };
  }
  if (step.kind === 'strides') {
    return { title: `${step.count} × ${step.duration_s} s strides`, detail: 'Quick and relaxed, walk back to recover', zones: ['rep'] };
  }
  if (step.kind === 'run') {
    return {
      title: `${formatAmount(step, unit)} ${label(step.zone)}`,
      detail: pace(step.zone) ?? (step.zone === 'effort' ? 'Run by feel' : null),
      zones: [step.zone],
    };
  }
  if (step.kind === 'repeat') {
    const reps = step.reps;
    const recovery = recoveryText(step.recovery, unit);
    const allSame = reps.every((r) => sameParts(r, reps[0]));
    if (allSame && reps[0].parts.length === 1) {
      const part = reps[0].parts[0];
      const split = part.distance_m ? splitRange(zones, part.zone, part.distance_m) : null;
      const paceText = pace(part.zone);
      return {
        title: `${reps.length} × ${formatAmount(part, unit)}`,
        detail: [
          label(part.zone),
          split ? `${split} each${paceText ? ` (${paceText})` : ''}` : paceText,
          recovery,
        ].filter(Boolean).join(' · '),
        zones: [part.zone],
      };
    }
    if (allSame) {
      // Over/unders: "4 × (2 min 10K pace + 3 min half marathon pace)"
      const parts = reps[0].parts;
      return {
        title: `${reps.length} × (${parts.map((p) => `${formatAmount(p, unit)} ${label(p.zone)}`).join(' + ')})`,
        detail: [parts.map((p) => pace(p.zone)).filter(Boolean).join(' / '), recovery].filter(Boolean).join(' · '),
        zones: parts.map((p) => p.zone),
      };
    }
    // Ladders, pyramids, cutdowns and surges: list each rep
    const list = reps.map((r) => r.parts.map((p) => `${formatAmount(p, unit)} ${label(p.zone)}`).join(' + ')).join(', ');
    const zoneSet = [...new Set(reps.flatMap((r) => r.parts.map((p) => p.zone)))];
    return {
      title: list,
      detail: [zoneSet.filter((z) => zones?.[z]).map((z) => `${label(z)} ${pace(z)}`).join(' · '), recovery].filter(Boolean).join(' · '),
      zones: zoneSet,
    };
  }
  return { title: step.kind, detail: null, zones: [] };
}

/** One-line summary of a run's main set, for compact lists: "6 × 800 m". */
export function mainSetSummary(steps, unit) {
  const main = steps.filter((s) => s.kind !== 'warmup' && s.kind !== 'cooldown' && s.kind !== 'strides');
  if (!main.length) return null;
  if (main.length === 1 && main[0].kind === 'run' && ['easy', 'recovery'].includes(main[0].zone)) return null;
  // Progressions: "easy → steady → marathon pace"
  const runs = main.filter((s) => s.kind === 'run');
  if (runs.length === main.length && runs.length >= 3) {
    return runs.map((s) => ZONE_LABELS[s.zone]).filter((z, i, list) => z !== list[i - 1]).join(' → ');
  }
  const first = main.find((s) => s.kind === 'repeat') ?? main.find((s) => s.kind === 'run' && !['easy', 'recovery'].includes(s.zone));
  if (!first) return null;
  if (first.kind === 'repeat') {
    const reps = first.reps;
    const same = reps.every((r) => sameParts(r, reps[0]));
    if (same && reps[0].parts.length === 1) return `${reps.length} × ${formatAmount(reps[0].parts[0], unit)} ${ZONE_LABELS[reps[0].parts[0].zone]}`;
    if (same) return `${reps.length} × (${reps[0].parts.map((p) => formatAmount(p, unit)).join(' + ')})`;
    return `${reps.length} reps`;
  }
  return `${formatAmount(first, unit)} ${ZONE_LABELS[first.zone]}`;
}

export const PHASE_LABELS = {
  base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', race: 'Race week', maintain: 'Maintenance',
};

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
