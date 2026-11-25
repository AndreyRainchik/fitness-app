/**
 * Weight units in the browser. Same rounding as the server's convertWeight
 * (backend/src/utils/units.js); keep the two in step.
 */

export const LBS_PER_KG = 2.20462262185;

/** Short label: 'lbs' or 'kg'. */
export const unitLabel = (units) => (units === 'kg' ? 'kg' : 'lbs');

/**
 * value in `from` units as `to` units, to 0.01, snapped to a multiple of
 * 0.25 when within 0.015 (so 135 lbs -> 61.23 kg -> 135 lbs). Blank or
 * non-numeric values, and same-unit conversions, come back unchanged.
 */
export function convertWeight(value, from, to) {
  if (value === '' || value === null || value === undefined || !from || !to || from === to || Number.isNaN(Number(value))) {
    return value;
  }
  const converted = to === 'kg' ? Number(value) / LBS_PER_KG : Number(value) * LBS_PER_KG;
  const rounded = Math.round(converted * 100) / 100;
  const quarter = Math.round(rounded * 4) / 4;
  return Math.abs(rounded - quarter) <= 0.015 ? quarter : rounded;
}
