/**
 * Weight units. Lifting weights are stored in each user's own unit
 * (users.units); switching units converts them all (convertSavedWeights).
 */

export const LBS_PER_KG = 2.20462262185;

/**
 * value in `from` units as `to` units, to 0.01. A result within 0.015 of a
 * multiple of 0.25 is snapped to it, so converting back and forth returns
 * the original plate-friendly number (135 lbs -> 61.23 kg -> 135 lbs).
 */
export function convertWeight(value, from, to) {
  if (value === null || value === undefined || value === '' || from === to) return value;
  const converted = to === 'kg' ? Number(value) / LBS_PER_KG : Number(value) * LBS_PER_KG;
  const rounded = Math.round(converted * 100) / 100;
  const quarter = Math.round(rounded * 4) / 4;
  return Math.abs(rounded - quarter) <= 0.015 ? quarter : rounded;
}
