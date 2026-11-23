/**
 * Analysis of a session's second-by-second data: best efforts, heart rate
 * histogram and zones, VDOT and race predictions, and chart-sized series.
 *
 * Pure functions (no database, files or network) so they can be tested directly.
 *
 * A stream is { time: [s], distance?: [m], heartrate?: [bpm], velocity?: [m/s],
 * altitude?: [m], cadence?: [], latlng?: [[lat, lng]] }, arrays of equal length.
 */

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

const STRAVA_KEYS = {
  time: 'time', distance: 'distance', heartrate: 'heartrate', velocity_smooth: 'velocity',
  altitude: 'altitude', cadence: 'cadence', latlng: 'latlng',
};

/**
 * Strava's streams response (key_by_type=true: { time: { data: [...] }, ... })
 * -> a stream. Returns null when there's no time series.
 */
export function streamFromStrava(response) {
  const time = response?.time?.data;
  if (!Array.isArray(time) || time.length < 2) return null;
  const stream = {};
  for (const [stravaKey, key] of Object.entries(STRAVA_KEYS)) {
    const data = response[stravaKey]?.data;
    if (Array.isArray(data) && data.length === time.length) stream[key] = data;
  }
  return stream;
}

// ---------------------------------------------------------------------------
// Best efforts
// ---------------------------------------------------------------------------

export const EFFORT_DISTANCES = [
  { key: '400m', label: '400 m', meters: 400 },
  { key: '1k', label: '1 km', meters: 1000 },
  { key: '1mi', label: '1 mile', meters: 1609.344 },
  { key: '5k', label: '5 km', meters: 5000 },
  { key: '10k', label: '10 km', meters: 10000 },
  { key: 'half', label: 'Half marathon', meters: 21097.5 },
  { key: 'marathon', label: 'Marathon', meters: 42195 },
];

/**
 * Fastest time (seconds) to cover each standard distance anywhere in the
 * run: { '1k': 241.3, '5k': 1290.7, ... } for every distance the run covers.
 * The window's start is interpolated, so it covers exactly the distance.
 */
export function bestEfforts(stream) {
  const { time, distance } = stream || {};
  if (!Array.isArray(distance) || distance.length < 2) return {};
  const total = distance[distance.length - 1] - distance[0];
  const result = {};

  for (const { key, meters } of EFFORT_DISTANCES) {
    if (total < meters) continue;
    let best = Infinity;
    let i = 0;
    for (let j = 1; j < distance.length; j++) {
      const target = distance[j] - meters; // where a window ending at j starts
      if (target < distance[0]) continue;
      while (i + 1 < j && distance[i + 1] <= target) i++;
      const span = distance[i + 1] - distance[i];
      const fraction = span > 0 ? (target - distance[i]) / span : 0;
      const start = time[i] + fraction * (time[i + 1] - time[i]);
      const seconds = time[j] - start;
      if (seconds > 0 && seconds < best) best = seconds;
    }
    if (Number.isFinite(best)) result[key] = Math.round(best * 10) / 10;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Heart rate
// ---------------------------------------------------------------------------

// Gaps longer than this (a pause, a dropped sensor) count as this long
const MAX_SAMPLE_GAP_S = 5;

/** Seconds at each heart rate: [[bpm, seconds], ...] sorted by bpm, or null. */
export function hrHistogram(stream) {
  const { time, heartrate } = stream || {};
  if (!Array.isArray(heartrate) || heartrate.length < 2) return null;
  const seconds = new Map();
  for (let i = 1; i < heartrate.length; i++) {
    const bpm = Math.round(heartrate[i]);
    const dt = Math.min(MAX_SAMPLE_GAP_S, Math.max(0, time[i] - time[i - 1]));
    if (!(bpm >= 30 && bpm <= 250) || dt === 0) continue;
    seconds.set(bpm, (seconds.get(bpm) || 0) + dt);
  }
  if (seconds.size === 0) return null;
  return [...seconds.entries()].sort((a, b) => a[0] - b[0]).map(([bpm, s]) => [bpm, Math.round(s)]);
}

// Zone floors as a share of max HR, or of heart rate reserve when resting HR is known
const ZONE_FLOORS = [0.5, 0.6, 0.7, 0.8, 0.9];
export const ZONE_NAMES = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'Max'];

/**
 * Five zones from heart rate settings: [{ zone: 1..5, name, min, max }]
 * (bpm, min inclusive). With resting HR the floors are resting + share ×
 * (max − resting) (Karvonen); without it, share × max. Zone 1 also takes
 * anything below its floor, zone 5 anything above max.
 */
export function hrZones({ max_hr: max, resting_hr: rest }) {
  const floor = (share) => Math.round(rest ? rest + share * (max - rest) : share * max);
  return ZONE_FLOORS.map((share, i) => ({
    zone: i + 1,
    name: ZONE_NAMES[i],
    min: floor(share),
    max: i < ZONE_FLOORS.length - 1 ? floor(ZONE_FLOORS[i + 1]) - 1 : max,
  }));
}

/** Seconds in each of the five zones, from a histogram. */
export function zoneSeconds(histogram, zones) {
  const result = [0, 0, 0, 0, 0];
  for (const [bpm, seconds] of histogram || []) {
    let index = 0;
    for (let z = zones.length - 1; z >= 0; z--) {
      if (bpm >= zones[z].min) { index = z; break; }
    }
    result[index] += seconds;
  }
  return result;
}

/** The settings in effect on a date: the latest on or before it, else the earliest. */
export function thresholdsOn(list, date) {
  if (!list?.length) return null;
  const sorted = [...list].sort((a, b) => String(a.effective_date).localeCompare(String(b.effective_date)));
  let current = sorted[0];
  for (const t of sorted) if (String(t.effective_date) <= String(date).slice(0, 10)) current = t;
  return current;
}

// ---------------------------------------------------------------------------
// VDOT (Jack Daniels' running formula)
// ---------------------------------------------------------------------------

function vo2Cost(metersPerMinute) {
  return -4.60 + 0.182258 * metersPerMinute + 0.000104 * metersPerMinute ** 2;
}

function sustainableShare(minutes) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
}

/** VDOT for running `meters` in `seconds`. */
export function vdot(meters, seconds) {
  const minutes = seconds / 60;
  return vo2Cost(meters / minutes) / sustainableShare(minutes);
}

/** Predicted race time (seconds) over `meters` for a VDOT. */
export function predictTime(vdotValue, meters) {
  // vdot() falls as time grows, so bisect on time
  let lo = (meters / 1000) * 90; // 1:30 per km
  let hi = (meters / 1000) * 1200; // 20:00 per km
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdot(meters, mid) > vdotValue) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

// Efforts shorter than this say little about endurance, so they don't set VDOT
const MIN_VDOT_METERS = 1609;

/**
 * The best VDOT among efforts: [{ effort_key, seconds, ... }] -> { vdot, effort }
 * (the effort it came from), or null.
 */
export function bestVdot(efforts) {
  let best = null;
  for (const effort of efforts) {
    const distance = EFFORT_DISTANCES.find((d) => d.key === effort.effort_key);
    if (!distance || distance.meters < MIN_VDOT_METERS || !(effort.seconds > 0)) continue;
    const value = vdot(distance.meters, effort.seconds);
    if (!best || value > best.vdot) best = { vdot: Math.round(value * 10) / 10, effort };
  }
  return best;
}

export const PREDICTION_DISTANCES = ['5k', '10k', 'half', 'marathon'];

// ---------------------------------------------------------------------------
// Charts and maps
// ---------------------------------------------------------------------------

const average = (values) => {
  const nums = values.filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};

/**
 * At most maxPoints points for charts, each the average of a run of samples:
 * [{ t (s), d (m)?, hr?, v (m/s)?, alt?, cad? }].
 */
export function chartSeries(stream, maxPoints = 500) {
  const n = stream?.time?.length || 0;
  if (n < 2) return [];
  const size = Math.max(1, Math.ceil(n / maxPoints));
  const points = [];
  for (let start = 0; start < n; start += size) {
    const end = Math.min(n, start + size);
    const slice = (key) => (stream[key] ? stream[key].slice(start, end) : []);
    const point = { t: Math.round(stream.time[end - 1]) };
    const round = (v, digits = 0) => (v === null ? undefined : Math.round(v * 10 ** digits) / 10 ** digits);
    if (stream.distance) point.d = round(stream.distance[end - 1], 1);
    if (stream.heartrate) point.hr = round(average(slice('heartrate')));
    if (stream.velocity) point.v = round(average(slice('velocity')), 3);
    if (stream.altitude) point.alt = round(average(slice('altitude')), 1);
    if (stream.cadence) point.cad = round(average(slice('cadence')));
    points.push(point);
  }
  return points;
}

/** The GPS track thinned to at most maxPoints [lat, lng] pairs, or null. */
export function routePoints(stream, maxPoints = 1500) {
  const latlng = (stream?.latlng || []).filter((p) => Array.isArray(p) && p.length === 2);
  if (latlng.length < 2) return null;
  const step = Math.max(1, Math.ceil(latlng.length / maxPoints));
  const points = latlng.filter((_, i) => i % step === 0);
  if (points[points.length - 1] !== latlng[latlng.length - 1]) points.push(latlng[latlng.length - 1]);
  return points.map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
}
