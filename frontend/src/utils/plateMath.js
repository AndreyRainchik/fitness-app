import { convertWeight } from './units';

/**
 * Barbell plate math, done in the browser.
 *
 * Mirrors User.calculatePlatesNeeded in backend/src/models/User.js (which
 * still serves POST /api/profile/calculate-plates); keep the two in step.
 *
 * inventory: { bar_weight: 45, plates: { '45': 4, '25': 4, ... }, units }
 * where each count is how many of that plate can go on one side, and units
 * ('lbs' | 'kg') is the plates' own unit.
 *
 * targetUnits is the unit targetWeight is in (the user's). When it differs
 * from the plates' unit, the target is converted first, so a 61.23 kg set
 * on a pound plate set loads 135 lbs.
 *
 * Returns { plates, per_side, total, exact, units, totalInTarget }:
 * - plates: plate weights for one side, heaviest first (plate units)
 * - per_side: weight each side needs to reach the target (plate units)
 * - total: what the loaded bar actually weighs (plate units)
 * - totalInTarget: the same, in targetUnits
 * - exact: whether total hits the target
 */
export function calculatePlates(targetWeight, inventory, targetUnits) {
  const units = inventory?.units || targetUnits || 'lbs';
  const result = platesFor(Number(convertWeight(Number(targetWeight), targetUnits, units)), inventory);
  return { ...result, units, totalInTarget: convertWeight(result.total, units, targetUnits) };
}

function platesFor(target, inventory) {
  const barWeight = Number(inventory?.bar_weight) || 45;

  if (target === barWeight) {
    return { plates: [], per_side: 0, total: barWeight, exact: true };
  }

  const weightPerSide = (target - barWeight) / 2;
  if (!(weightPerSide > 0)) {
    // Lighter than the empty bar: the bar is the closest you can get
    return { plates: [], per_side: 0, total: barWeight, exact: false };
  }

  const available = inventory?.plates || {};
  const sizes = Object.keys(available)
    .map(parseFloat)
    .filter((size) => size > 0)
    .sort((a, b) => b - a);

  // Greedy: largest plates first, limited by how many of each you own
  const plates = [];
  let remaining = weightPerSide;
  for (const size of sizes) {
    const count = Number(available[String(size)] ?? available[size]) || 0;
    for (let used = 0; used < count && remaining >= size; used++) {
      plates.push(size);
      remaining -= size;
    }
  }

  remaining = Math.round(remaining * 4) / 4;
  return {
    plates,
    per_side: weightPerSide,
    total: barWeight + plates.reduce((sum, p) => sum + p, 0) * 2,
    exact: remaining < 0.01,
  };
}

/**
 * The weight you can actually load for a programmed weight, in the same
 * units as the programmed weight. { adjustedWeight, isAdjusted }
 */
export function achievableWeight(targetWeight, inventory, targetUnits) {
  const result = calculatePlates(targetWeight, inventory, targetUnits);
  const adjustedWeight = Number(result.totalInTarget) || targetWeight;
  return {
    adjustedWeight,
    isAdjusted: !result.exact || Math.abs(adjustedWeight - targetWeight) > 0.01,
  };
}
