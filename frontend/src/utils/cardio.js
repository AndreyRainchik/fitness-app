import { Activity, Bike, Dumbbell, Footprints, Mountain, Waves } from 'lucide-react';

/**
 * Cardio sports and how to show their numbers. `pace` sports show time per
 * distance (run, row); the rest show speed.
 */
export const SPORTS = {
  run: { label: 'Run', noun: 'run', icon: Footprints, hasDistance: true, metric: 'pace' },
  ride: { label: 'Ride', noun: 'ride', icon: Bike, hasDistance: true, metric: 'speed' },
  row: { label: 'Row', noun: 'row', icon: Waves, hasDistance: true, metric: 'pace500' },
  boulder: { label: 'Bouldering', noun: 'bouldering session', icon: Mountain, hasDistance: false, metric: null },
  other: { label: 'Other', noun: 'session', icon: Activity, hasDistance: true, metric: 'speed' },
};

export const SPORT_IDS = Object.keys(SPORTS);

/** Strength + each sport, in chart stacking order, with series colors from index.css. */
export const ACTIVITY_TYPES = [
  { id: 'strength', label: 'Strength', icon: Dumbbell },
  ...SPORT_IDS.map((id) => ({ id, label: SPORTS[id].label, icon: SPORTS[id].icon })),
].map((t) => ({ ...t, color: `var(--activity-${t.id})` }));

export const sportInfo = (sport) => SPORTS[sport] ?? SPORTS.other;

/** "Outdoor run", "Indoor ride", "Bouldering". */
export function sessionTitle(sport, environment) {
  const info = sportInfo(sport);
  if (sport === 'boulder' || !environment) return info.label;
  if (sport === 'run' && environment === 'indoor') return 'Treadmill run';
  return `${environment === 'indoor' ? 'Indoor' : 'Outdoor'} ${info.label.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Units: distance follows the weight setting (lbs -> miles, kg -> km)
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function distanceUnit(weightUnits) {
  return weightUnits === 'kg' ? 'km' : 'mi';
}

const metersPer = (unit) => (unit === 'mi' ? METERS_PER_MILE : 1000);

/** metres -> number in km or mi */
export const metersTo = (meters, unit) => meters / metersPer(unit);
/** km or mi -> metres */
export const toMeters = (value, unit) => value * metersPer(unit);

export const elevationUnit = (unit) => (unit === 'mi' ? 'ft' : 'm');
export const metersToElevation = (meters, unit) => (unit === 'mi' ? meters / METERS_PER_FOOT : meters);
export const elevationToMeters = (value, unit) => (unit === 'mi' ? value * METERS_PER_FOOT : value);

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 3725 -> "1:02:05", 1500 -> "25:00" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 3725 -> "1h 2m", 1500 -> "25m", 0 -> "0m" */
export function formatDuration(totalSeconds) {
  const minutes = Math.round((totalSeconds || 0) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** metres -> "8.05 km" / "5.00 mi" */
export function formatDistance(meters, unit, digits = 2) {
  if (!(meters > 0)) return null;
  return `${metersTo(meters, unit).toFixed(digits)} ${unit}`;
}

/**
 * The sport's speed figure, or null when it can't be worked out:
 * run "4:51 /km", row "2:05 /500m", ride "28.4 km/h".
 */
export function formatPaceOrSpeed(sport, meters, seconds, unit) {
  if (!(meters > 0) || !(seconds > 0)) return null;
  const metric = sportInfo(sport).metric;
  if (metric === 'pace') return `${formatClock(seconds / metersTo(meters, unit))} /${unit}`;
  if (metric === 'pace500') return `${formatClock((seconds / meters) * 500)} /500m`;
  if (metric === 'speed') return `${(metersTo(meters, unit) / (seconds / 3600)).toFixed(1)} ${unit === 'mi' ? 'mph' : 'km/h'}`;
  return null;
}

/** Label for the pace/speed figure of a sport ("Avg pace", "Avg split", "Avg speed"). */
export function paceLabel(sport) {
  const metric = sportInfo(sport).metric;
  if (metric === 'pace') return 'Avg pace';
  if (metric === 'pace500') return 'Avg split';
  return 'Avg speed';
}

/** One-line summary for lists: "8.05 km · 46m · 4:51 /km · 148 bpm" */
export function cardioSummaryLine(session, unit) {
  const seconds = session.duration_s ?? (session.duration_minutes || 0) * 60;
  return [
    formatDistance(session.distance_m, unit),
    seconds > 0 ? formatDuration(seconds) : null,
    formatPaceOrSpeed(session.sport, session.distance_m, seconds, unit),
    session.avg_hr ? `${session.avg_hr} bpm` : null,
  ].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// Duration input: "45", "45:30", "1:05:00" -> seconds
// ---------------------------------------------------------------------------

/** Parse h:mm:ss, mm:ss or plain minutes. Returns seconds, or null if invalid. */
export function parseDuration(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60);
  const parts = value.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((total, n) => total * 60 + n, 0);
}
