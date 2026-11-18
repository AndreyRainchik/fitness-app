/**
 * Barbell plate math, done in the browser.
 *
 * Mirrors User.calculatePlatesNeeded in backend/src/models/User.js (which
 * still serves POST /api/profile/calculate-plates); keep the two in step.
 *
 * inventory: { bar_weight: 45, plates: { '45': 4, '25': 4, ... } } where
 * each count is how many of that plate can go on one side.
 *
 * Returns { plates, per_side, total, exact }:
 * - plates: plate weights for one side, heaviest first
 * - per_side: weight each side needs to reach the target
 * - total: what the loaded bar actually weighs
 * - exact: whether total hits the target
 */
export function calculatePlates(targetWeight, inventory) {
  const target = Number(targetWeight);
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
 * The weight you can actually load for a programmed weight.
 * { adjustedWeight, isAdjusted }
 */
export function achievableWeight(targetWeight, inventory) {
  const result = calculatePlates(targetWeight, inventory);
  const adjustedWeight = result.total || targetWeight;
  return {
    adjustedWeight,
    isAdjusted: !result.exact || Math.abs(adjustedWeight - targetWeight) > 0.01,
  };
}
