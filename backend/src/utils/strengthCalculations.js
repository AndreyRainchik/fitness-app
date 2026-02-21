/**
 * Strength Calculations Utility
 * 
 * Provides 1RM estimation, Wilks coefficients, strength standards,
 * and balance ratio analysis for powerlifting movements.
 */

// ============================================================================
// 1RM ESTIMATION FORMULAS
// ============================================================================

/**
 * Brzycki Formula (best for lower rep ranges: 1-7 reps)
 * 1RM = weight × (36 / (37 - reps))
 */
function brzycki(weight, reps) {
  if (reps >= 37) return weight * 2; // Safety fallback
  return weight * (36 / (37 - reps));
}

/**
 * Epley Formula (best for higher rep ranges: 10+ reps)
 * 1RM = weight × (1 + reps/30)
 */
function epley(weight, reps) {
  return weight * (1 + reps / 30);
}

/**
 * Interpolate between Brzycki and Epley for 8-10 rep range
 */
function interpolate(weight, reps) {
  const brzyckiEstimate = brzycki(weight, reps);
  const epleyEstimate = epley(weight, reps);
  
  // Linear interpolation: 8 reps = 100% Brzycki, 10 reps = 100% Epley
  const factor = (reps - 8) / 2; // 0 at 8 reps, 1 at 10 reps
  
  return brzyckiEstimate * (1 - factor) + epleyEstimate * factor;
}

/**
 * Hybrid 1RM Estimation
 * Automatically selects the most accurate formula based on rep range
 * 
 * @param {number} weight - Weight lifted
 * @param {number} reps - Number of reps completed
 * @returns {number} - Estimated 1RM
 */
export function estimate1RM(weight, reps) {
  // Validate inputs
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  
  // Choose formula based on rep range
  if (reps < 8) {
    return brzycki(weight, reps);
  } else if (reps > 10) {
    return epley(weight, reps);
  } else {
    // Interpolate for 8-10 rep range
    return interpolate(weight, reps);
  }
}

// ============================================================================
// WILKS COEFFICIENT
// ============================================================================

/**
 * Calculate Wilks Coefficient for relative strength comparison
 * Wilks = (total lifted in kg) × (500 / (a + b×BW + c×BW² + d×BW³ + e×BW⁴ + f×BW⁵))
 * 
 * @param {number} totalKg - Total weight lifted (kg)
 * @param {number} bodyweightKg - Bodyweight (kg)
 * @param {string} sex - 'M' or 'F'
 * @returns {number} - Wilks coefficient
 */
export function calculateWilks(totalKg, bodyweightKg, sex) {
  if (totalKg <= 0 || bodyweightKg <= 0) return 0;
  
  // Wilks coefficients (2020 formula)
  const coefficients = {
    M: {
      a: -216.0475144,
      b: 16.2606339,
      c: -0.002388645,
      d: -0.00113732,
      e: 7.01863e-6,
      f: -1.291e-8
    },
    F: {
      a: 594.31747775582,
      b: -27.23842536447,
      c: 0.82112226871,
      d: -0.00930733913,
      e: 0.00004731582,
      f: -0.00000009054
    }
  };
  
  const coef = coefficients[sex] || coefficients.M;
  const bw = bodyweightKg;
  
  // Calculate denominator
  const denominator = coef.a + 
    coef.b * bw + 
    coef.c * Math.pow(bw, 2) + 
    coef.d * Math.pow(bw, 3) + 
    coef.e * Math.pow(bw, 4) + 
    coef.f * Math.pow(bw, 5);
  
  // Wilks = total × (500 / denominator)
  return totalKg * (500 / denominator);
}

// ============================================================================
// PERCENT OF POWERLIFTING TOTAL
// ============================================================================

/**
 * Returns the expected percentage of a powerlifting total that a given lift
 * represents, based on sex. Deadlift is the anchor; other lifts are derived
 * as fractions of the deadlift share.
 *
 * @param {string} sex - 'M' or 'F'
 * @param {string} liftName - Normalized exercise name
 * @returns {number} - Decimal fraction (e.g. 0.396825)
 */
function percentOfPLTotal(sex, liftName) {
  const dlShare = sex === 'F' ? 0.414938 : 0.396825;

  switch (liftName) {
    case 'Barbell Deadlift':
      return dlShare;
    case 'Barbell Squat':
      return (sex === 'F' ? 0.84 : 0.87) * dlShare;
    case 'Barbell Bench Press':
      return (sex === 'F' ? 0.57 : 0.65) * dlShare;
    case 'Barbell Overhead Press':
      return 0.65 * (sex === 'F' ? 0.57 : 0.65) * dlShare;
    default:
      return 1;
  }
}

// ============================================================================
// WILKS TO STRENGTH SCORE
// ============================================================================

/**
 * Convert a Wilks score into a normalized strength score.
 * Optionally applies an age adjustment for lifters under 23 or over 40.
 *
 * Strength score ranges:
 *   >= 125  World Class
 *   >= 112.5  Elite
 *   >= 100  Exceptional
 *   >= 87.5  Advanced
 *   >= 75   Proficient
 *   >= 60   Intermediate
 *   >= 45   Novice
 *   >= 30   Untrained
 *   <  30   Subpar
 *
 * @param {number} wilks - Wilks score
 * @param {number|null} age - Optional age for adjustment (null = no adjustment)
 * @returns {number} - Strength score
 */
function wilksToStrengthScore(wilks, age = null) {
  let ageMultiplier = 1;

  if (typeof age === 'number' && age < 23) {
    ageMultiplier = 0.0038961 * Math.pow(age, 2) - 0.166926 * age + 2.80303;
  } else if (typeof age === 'number' && age > 40) {
    ageMultiplier = 0.000467683 * Math.pow(age, 2) - 0.0299717 * age + 1.45454;
  }

  return (wilks * ageMultiplier) / 4;
}

// ============================================================================
// SINGLE LIFT STRENGTH SCORE
// ============================================================================

/**
 * Calculate a strength score for a single lift by extrapolating a powerlifting
 * total, converting to Wilks, and applying an optional age adjustment.
 *
 * @param {string} sex - 'M' or 'F'
 * @param {number} bodyweightLbs - Bodyweight in pounds
 * @param {number} liftWeightLbs - Lift 1RM in pounds
 * @param {string} liftName - Normalized exercise name
 * @param {number|null} age - Optional age for adjustment
 * @returns {number} - Strength score for this lift
 */
export function singleLiftStrengthScore(sex, bodyweightLbs, liftWeightLbs, liftName, age = null) {
  if (liftWeightLbs <= 0 || bodyweightLbs <= 0) return 0;

  const lbToKg = 0.453592;

  // Extrapolate what the full PL total would be based on this single lift
  const plTotalLbs = liftWeightLbs / percentOfPLTotal(sex, liftName);

  // Convert to kg and compute Wilks
  const wilks = calculateWilks(plTotalLbs * lbToKg, bodyweightLbs * lbToKg, sex);

  return wilksToStrengthScore(wilks, age);
}

// ============================================================================
// STRENGTH STANDARDS DATABASE
// ============================================================================

/**
 * Strength Standards by Exercise, Sex, and Bodyweight
 * Data source: StrengthLevel.com standards
 * Values in pounds (lbs)
 */
const STRENGTH_STANDARDS = {
  'Barbell Squat': {
    M: {
      130: { beginner: 100, novice: 147, intermediate: 206, advanced: 274, elite: 349 },
      140: { beginner: 113, novice: 162, intermediate: 224, advanced: 295, elite: 373 },
      150: { beginner: 125, novice: 177, intermediate: 242, advanced: 316, elite: 396 },
      160: { beginner: 138, novice: 192, intermediate: 259, advanced: 336, elite: 418 },
      170: { beginner: 150, novice: 207, intermediate: 276, advanced: 355, elite: 439 },
      180: { beginner: 162, novice: 221, intermediate: 292, advanced: 373, elite: 460 },
      190: { beginner: 174, novice: 235, intermediate: 308, advanced: 391, elite: 479 },
      200: { beginner: 186, novice: 248, intermediate: 323, advanced: 408, elite: 499 },
      210: { beginner: 197, novice: 261, intermediate: 338, advanced: 425, elite: 517 },
      220: { beginner: 209, novice: 274, intermediate: 353, advanced: 442, elite: 535 },
      230: { beginner: 220, novice: 287, intermediate: 367, advanced: 457, elite: 553 },
      240: { beginner: 230, novice: 299, intermediate: 381, advanced: 473, elite: 570 },
      250: { beginner: 241, novice: 311, intermediate: 395, advanced: 488, elite: 586 },
    },
    F: {
      100: { beginner: 41, novice: 76, intermediate: 92, advanced: 127, elite: 171 },
      110: { beginner: 46, novice: 86, intermediate: 105, advanced: 145, elite: 196 },
      120: { beginner: 52, novice: 96, intermediate: 117, advanced: 163, elite: 220 },
      130: { beginner: 57, novice: 106, intermediate: 130, advanced: 180, elite: 243 },
      140: { beginner: 62, novice: 116, intermediate: 142, advanced: 198, elite: 267 },
      150: { beginner: 68, novice: 126, intermediate: 154, advanced: 215, elite: 290 },
      160: { beginner: 73, novice: 136, intermediate: 167, advanced: 232, elite: 313 },
      170: { beginner: 78, novice: 145, intermediate: 179, advanced: 249, elite: 336 },
      180: { beginner: 84, novice: 155, intermediate: 191, advanced: 266, elite: 359 },
      190: { beginner: 89, novice: 165, intermediate: 203, advanced: 283, elite: 381 },
      200: { beginner: 94, novice: 174, intermediate: 215, advanced: 299, elite: 404 },
    }
  },
  'Barbell Bench Press': {
    M: {
      130: { beginner: 73, novice: 109, intermediate: 154, advanced: 208, elite: 266 },
      140: { beginner: 83, novice: 121, intermediate: 169, advanced: 224, elite: 285 },
      150: { beginner: 93, novice: 133, intermediate: 182, advanced: 240, elite: 302 },
      160: { beginner: 102, novice: 144, intermediate: 196, advanced: 255, elite: 319 },
      170: { beginner: 112, novice: 155, intermediate: 209, advanced: 270, elite: 336 },
      180: { beginner: 121, novice: 166, intermediate: 221, advanced: 284, elite: 352 },
      190: { beginner: 130, novice: 177, intermediate: 234, advanced: 298, elite: 367 },
      200: { beginner: 139, novice: 187, intermediate: 246, advanced: 312, elite: 382 },
      210: { beginner: 148, novice: 197, intermediate: 257, advanced: 325, elite: 397 },
      220: { beginner: 156, novice: 207, intermediate: 269, advanced: 338, elite: 411 },
      230: { beginner: 165, novice: 217, intermediate: 280, advanced: 350, elite: 425 },
      240: { beginner: 173, novice: 227, intermediate: 291, advanced: 362, elite: 438 },
      250: { beginner: 181, novice: 236, intermediate: 301, advanced: 374, elite: 451 },
    },
    F: {
      100: { beginner: 28, novice: 42, intermediate: 49, advanced: 66, elite: 86 },
      110: { beginner: 32, novice: 48, intermediate: 56, advanced: 76, elite: 99 },
      120: { beginner: 36, novice: 54, intermediate: 64, advanced: 86, elite: 112 },
      130: { beginner: 40, novice: 60, intermediate: 71, advanced: 96, elite: 125 },
      140: { beginner: 44, novice: 66, intermediate: 78, advanced: 106, elite: 138 },
      150: { beginner: 48, novice: 72, intermediate: 85, advanced: 115, elite: 151 },
      160: { beginner: 52, novice: 78, intermediate: 93, advanced: 125, elite: 164 },
      170: { beginner: 56, novice: 84, intermediate: 100, advanced: 135, elite: 177 },
      180: { beginner: 60, novice: 90, intermediate: 107, advanced: 145, elite: 190 },
      190: { beginner: 64, novice: 96, intermediate: 114, advanced: 154, elite: 202 },
      200: { beginner: 68, novice: 102, intermediate: 121, advanced: 164, elite: 215 },
    }
  },
  'Barbell Deadlift': {
    M: {
      130: { beginner: 126, novice: 179, intermediate: 246, advanced: 323, elite: 407 },
      140: { beginner: 140, novice: 197, intermediate: 266, advanced: 346, elite: 433 },
      150: { beginner: 154, novice: 213, intermediate: 286, advanced: 368, elite: 457 },
      160: { beginner: 168, novice: 229, intermediate: 304, advanced: 389, elite: 481 },
      170: { beginner: 181, novice: 245, intermediate: 322, advanced: 410, elite: 503 },
      180: { beginner: 195, novice: 261, intermediate: 340, advanced: 430, elite: 525 },
      190: { beginner: 208, novice: 275, intermediate: 357, advanced: 449, elite: 546 },
      200: { beginner: 220, novice: 290, intermediate: 373, advanced: 467, elite: 567 },
      210: { beginner: 233, novice: 304, intermediate: 389, advanced: 485, elite: 587 },
      220: { beginner: 245, novice: 318, intermediate: 405, advanced: 503, elite: 606 },
      230: { beginner: 257, novice: 332, intermediate: 420, advanced: 520, elite: 624 },
      240: { beginner: 268, novice: 345, intermediate: 435, advanced: 536, elite: 642 },
      250: { beginner: 280, novice: 358, intermediate: 450, advanced: 552, elite: 660 },
    },
    F: {
      100: { beginner: 53, novice: 95, intermediate: 115, advanced: 156, elite: 204 },
      110: { beginner: 60, novice: 108, intermediate: 131, advanced: 179, elite: 234 },
      120: { beginner: 67, novice: 121, intermediate: 147, advanced: 201, elite: 264 },
      130: { beginner: 74, novice: 134, intermediate: 163, advanced: 223, elite: 293 },
      140: { beginner: 81, novice: 147, intermediate: 179, advanced: 245, elite: 322 },
      150: { beginner: 88, novice: 159, intermediate: 194, advanced: 267, elite: 351 },
      160: { beginner: 95, novice: 172, intermediate: 210, advanced: 289, elite: 380 },
      170: { beginner: 102, novice: 184, intermediate: 225, advanced: 310, elite: 408 },
      180: { beginner: 109, novice: 197, intermediate: 241, advanced: 332, elite: 437 },
      190: { beginner: 116, novice: 209, intermediate: 256, advanced: 353, elite: 465 },
      200: { beginner: 123, novice: 221, intermediate: 271, advanced: 374, elite: 493 },
    }
  },
  'Barbell Overhead Press': {
    M: {
      130: { beginner: 45, novice: 70, intermediate: 102, advanced: 140, elite: 181 },
      140: { beginner: 51, novice: 77, intermediate: 111, advanced: 150, elite: 194 },
      150: { beginner: 57, novice: 85, intermediate: 120, advanced: 161, elite: 205 },
      160: { beginner: 63, novice: 92, intermediate: 128, advanced: 170, elite: 216 },
      170: { beginner: 69, novice: 99, intermediate: 136, advanced: 180, elite: 227 },
      180: { beginner: 75, novice: 106, intermediate: 145, advanced: 189, elite: 238 },
      190: { beginner: 80, novice: 113, intermediate: 152, advanced: 198, elite: 248 },
      200: { beginner: 86, novice: 119, intermediate: 160, advanced: 207, elite: 257 },
      210: { beginner: 91, novice: 126, intermediate: 168, advanced: 215, elite: 267 },
      220: { beginner: 97, novice: 132, intermediate: 175, advanced: 224, elite: 276 },
      230: { beginner: 102, novice: 138, intermediate: 182, advanced: 232, elite: 285 },
      240: { beginner: 107, novice: 144, intermediate: 189, advanced: 239, elite: 293 },
      250: { beginner: 112, novice: 150, intermediate: 196, advanced: 247, elite: 302 },
    },
    F: {
      100: { beginner: 19, novice: 28, intermediate: 33, advanced: 45, elite: 58 },
      110: { beginner: 21, novice: 32, intermediate: 38, advanced: 51, elite: 67 },
      120: { beginner: 24, novice: 36, intermediate: 43, advanced: 58, elite: 76 },
      130: { beginner: 27, novice: 40, intermediate: 48, advanced: 65, elite: 84 },
      140: { beginner: 30, novice: 45, intermediate: 53, advanced: 72, elite: 93 },
      150: { beginner: 33, novice: 49, intermediate: 58, advanced: 79, elite: 102 },
      160: { beginner: 36, novice: 53, intermediate: 63, advanced: 85, elite: 111 },
      170: { beginner: 38, novice: 57, intermediate: 68, advanced: 92, elite: 120 },
      180: { beginner: 41, novice: 61, intermediate: 73, advanced: 99, elite: 129 },
      190: { beginner: 44, novice: 66, intermediate: 78, advanced: 106, elite: 137 },
      200: { beginner: 47, novice: 70, intermediate: 83, advanced: 112, elite: 146 },
    }
  }
};

/**
 * Get the closest bodyweight class for standards lookup
 */
function getClosestBodyweightClass(bodyweightLbs, sex, exerciseName) {
  const standards = STRENGTH_STANDARDS[exerciseName];
  if (!standards || !standards[sex]) return null;
  
  const availableWeights = Object.keys(standards[sex]).map(Number).sort((a, b) => a - b);
  
  // Find closest weight class
  let closest = availableWeights[0];
  let minDiff = Math.abs(bodyweightLbs - closest);
  
  for (const weight of availableWeights) {
    const diff = Math.abs(bodyweightLbs - weight);
    if (diff < minDiff) {
      minDiff = diff;
      closest = weight;
    }
  }
  
  return closest;
}

/**
 * Determine strength standard level for a given lift
 * 
 * @param {string} exerciseName - Name of exercise (must match STRENGTH_STANDARDS keys)
 * @param {number} bodyweightLbs - User's bodyweight in pounds
 * @param {string} sex - 'M' or 'F'
 * @param {number} estimated1RM - Estimated 1RM in pounds
 * @returns {object} - { level: string, percentile: number, nextLevel: object }
 */
export function getStrengthStandard(exerciseName, bodyweightLbs, sex, estimated1RM) {
  // Normalize exercise name
  const normalizedName = normalizeExerciseName(exerciseName);
  
  if (!STRENGTH_STANDARDS[normalizedName]) {
    return {
      level: 'Unknown',
      percentile: 0,
      standards: null,
      nextLevel: null
    };
  }
  
  const weightClass = getClosestBodyweightClass(bodyweightLbs, sex, normalizedName);
  if (!weightClass) {
    return {
      level: 'Unknown',
      percentile: 0,
      standards: null,
      nextLevel: null
    };
  }
  
  const standards = STRENGTH_STANDARDS[normalizedName][sex][weightClass];

  const points = [
    { p: 0.05, v: standards.beginner },
    { p: 0.20, v: standards.novice },
    { p: 0.50, v: standards.intermediate },
    { p: 0.80, v: standards.advanced },
    { p: 0.95, v: standards.elite }
  ].sort((a, b) => a.v - b.v);
  
  // Determine level
  let level = 'Untrained';
  let percentile = 0;
  let nextLevel = null;
  
  if (estimated1RM >= standards.elite) {
    level = 'Elite';
    //percentile = 95;
  } else if (estimated1RM >= standards.advanced) {
    level = 'Advanced';
    //percentile = 80;
    nextLevel = { level: 'Elite', weight: standards.elite };
  } else if (estimated1RM >= standards.intermediate) {
    level = 'Intermediate';
    //percentile = 50;
    nextLevel = { level: 'Advanced', weight: standards.advanced };
  } else if (estimated1RM >= standards.novice) {
    level = 'Novice';
    //percentile = 20;
    nextLevel = { level: 'Intermediate', weight: standards.intermediate };
  } else if (estimated1RM >= standards.beginner) {
    level = 'Beginner';
    //percentile = 5;
    nextLevel = { level: 'Novice', weight: standards.novice };
  } else {
    level = 'Untrained';
    //percentile = 0;
    nextLevel = { level: 'Beginner', weight: standards.beginner };
  }

  if (estimated1RM <= points[0].v) {
    percentile = Math.round(points[0].p * 100);
  } 
  else if (estimated1RM >= points[points.length - 1].v) {
    percentile = Math.round(points[points.length - 1].p * 100);
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      if (estimated1RM >= a.v && estimated1RM <= b.v) {
        const t = (estimated1RM - a.v) / (b.v - a.v);
        percentile = Math.round((a.p + t * (b.p - a.p)) * 100);
      }
    }
  }
  
  return {
    level,
    percentile,
    standards,
    nextLevel
  };
}

/**
 * Normalize exercise names to match standards database
 */
function normalizeExerciseName(name) {
  const normalized = name.toLowerCase().trim();
  
  // Map common variations to standard names
  const mappings = {
    'squat': 'Barbell Squat',
    'back squat': 'Barbell Squat',
    'barbell squat': 'Barbell Squat',
    'bench': 'Barbell Bench Press',
    'bench press': 'Barbell Bench Press',
    'barbell bench': 'Barbell Bench Press',
    'barbell bench press': 'Barbell Bench Press',
    'deadlift': 'Barbell Deadlift',
    'barbell deadlift': 'Barbell Deadlift',
    'ohp': 'Barbell Overhead Press',
    'overhead press': 'Barbell Overhead Press',
    'press': 'Barbell Overhead Press',
    'barbell overhead press': 'Barbell Overhead Press',
    'shoulder press': 'Barbell Overhead Press',
    'military press': 'Barbell Overhead Press',
  };
  
  return mappings[normalized] || name;
}

// ============================================================================
// BALANCE RATIOS & SYMMETRY
// ============================================================================

/**
 * Calculate symmetry ratios between major lifts
 * 
 * @param {object} lifts - { squat: 1RM, bench: 1RM, deadlift: 1RM, ohp: 1RM }
 * @returns {object} - Various lift ratios
 */
export function calculateSymmetryRatios(lifts) {
  const { squat = 0, bench = 0, deadlift = 0, ohp = 0 } = lifts;
  
  return {
    // Primary ratios
    squatToDeadlift: squat > 0 && deadlift > 0 ? (squat / deadlift) : 0,
    benchToSquat: bench > 0 && squat > 0 ? (bench / squat) : 0,
    ohpToBench: ohp > 0 && bench > 0 ? (ohp / bench) : 0,
    deadliftToSquat: deadlift > 0 && squat > 0 ? (deadlift / squat) : 0,
    
    // Secondary ratios
    benchToDeadlift: bench > 0 && deadlift > 0 ? (bench / deadlift) : 0,
    ohpToDeadlift: ohp > 0 && deadlift > 0 ? (ohp / deadlift) : 0,
  };
}

/**
 * Ideal ratio ranges (based on powerlifting standards)
 */
const IDEAL_RATIOS = {
  squatToDeadlift: { min: 0.75, max: 0.95, ideal: 0.85 },
  benchToSquat: { min: 0.60, max: 0.80, ideal: 0.70 },
  ohpToBench: { min: 0.55, max: 0.70, ideal: 0.625 },
  deadliftToSquat: { min: 1.05, max: 1.35, ideal: 1.20 },
};

/**
 * Detect imbalances and provide recommendations
 * 
 * @param {object} ratios - Calculated ratios from calculateSymmetryRatios()
 * @param {object} lifts - Raw lift values
 * @returns {array} - Array of imbalance warnings and suggestions
 */
export function detectImbalances(ratios, lifts) {
  const imbalances = [];
  
  // Check Squat to Deadlift ratio
  if (ratios.squatToDeadlift > 0) {
    const { min, max, ideal } = IDEAL_RATIOS.squatToDeadlift;
    if (ratios.squatToDeadlift < min) {
      imbalances.push({
        type: 'weakness',
        severity: 'medium',
        lift: 'Squat',
        message: 'Your squat is relatively weak compared to your deadlift.',
        suggestion: 'Focus on squat volume and technique. Consider adding pause squats and front squats.',
        ratio: ratios.squatToDeadlift,
        ideal: ideal
      });
    } else if (ratios.squatToDeadlift > max) {
      imbalances.push({
        type: 'weakness',
        severity: 'medium',
        lift: 'Deadlift',
        message: 'Your deadlift is relatively weak compared to your squat.',
        suggestion: 'Increase deadlift frequency. Add deficit deadlifts and Romanian deadlifts.',
        ratio: ratios.squatToDeadlift,
        ideal: ideal
      });
    }
  }
  
  // Check Bench to Squat ratio
  if (ratios.benchToSquat > 0) {
    const { min, max, ideal } = IDEAL_RATIOS.benchToSquat;
    if (ratios.benchToSquat < min) {
      imbalances.push({
        type: 'weakness',
        severity: 'medium',
        lift: 'Bench Press',
        message: 'Your bench press is weak relative to your squat.',
        suggestion: 'Increase upper body pressing volume. Add close-grip bench and dips.',
        ratio: ratios.benchToSquat,
        ideal: ideal
      });
    } else if (ratios.benchToSquat > max) {
      imbalances.push({
        type: 'weakness',
        severity: 'low',
        lift: 'Squat',
        message: 'Your squat is relatively weak compared to your bench.',
        suggestion: 'Prioritize leg training. Your upper body is strong relative to lower body.',
        ratio: ratios.benchToSquat,
        ideal: ideal
      });
    }
  }
  
  // Check OHP to Bench ratio
  if (ratios.ohpToBench > 0) {
    const { min, max, ideal } = IDEAL_RATIOS.ohpToBench;
    if (ratios.ohpToBench < min) {
      imbalances.push({
        type: 'weakness',
        severity: 'low',
        lift: 'Overhead Press',
        message: 'Your overhead press is weak compared to bench press.',
        suggestion: 'Add more overhead pressing volume. Include push press and Z-press.',
        ratio: ratios.ohpToBench,
        ideal: ideal
      });
    }
  }
  
  // Check for disproportionate total strength
  const { squat, bench, deadlift } = lifts;
  if (squat > 0 && bench > 0 && deadlift > 0) {
    const total = squat + bench + deadlift;
    const squatPercent = (squat / total) * 100;
    const benchPercent = (bench / total) * 100;
    const deadliftPercent = (deadlift / total) * 100;
    
    // Ideal percentages for balanced powerlifter: Squat ~37%, Bench ~25%, Deadlift ~38%
    if (squatPercent < 33) {
      imbalances.push({
        type: 'proportion',
        severity: 'medium',
        lift: 'Squat',
        message: `Squat represents only ${squatPercent.toFixed(1)}% of your total (ideal: ~37%).`,
        suggestion: 'Your squat needs more focus compared to other lifts.',
        percentage: squatPercent
      });
    }
    
    if (benchPercent < 20) {
      imbalances.push({
        type: 'proportion',
        severity: 'medium',
        lift: 'Bench Press',
        message: `Bench represents only ${benchPercent.toFixed(1)}% of your total (ideal: ~25%).`,
        suggestion: 'Increase bench press training frequency and volume.',
        percentage: benchPercent
      });
    }
    
    if (deadliftPercent < 34) {
      imbalances.push({
        type: 'proportion',
        severity: 'medium',
        lift: 'Deadlift',
        message: `Deadlift represents only ${deadliftPercent.toFixed(1)}% of your total (ideal: ~38%).`,
        suggestion: 'Your deadlift needs significant work.',
        percentage: deadliftPercent
      });
    }
  }
  
  return imbalances;
}

/**
 * Calculate overall symmetry score (0-100) using the variance method.
 * Computes a per-lift strength score for each provided lift, then returns
 * 100 minus the variance of those scores. A perfect 100 means all lifts
 * imply the same overall strength level.
 *
 * @param {object} lifts - { squat, bench, deadlift, ohp } as 1RM in lbs
 * @param {string} sex - 'M' or 'F'
 * @param {number} bodyweightLbs - Bodyweight in pounds
 * @param {number|null} age - Optional age for adjustment
 * @returns {number} - Symmetry score (higher = more balanced)
 */
export function calculateSymmetryScore(lifts, sex, bodyweightLbs, age = null) {
  const liftMap = {
    squat: 'Barbell Squat',
    bench: 'Barbell Bench Press',
    deadlift: 'Barbell Deadlift',
    ohp: 'Barbell Overhead Press',
  };

  // Build array of strength scores for lifts that have values
  const scores = Object.entries(liftMap)
    .filter(([key]) => lifts[key] > 0)
    .map(([key, name]) => singleLiftStrengthScore(sex, bodyweightLbs, lifts[key], name, age));

  if (scores.length === 0) return 0;

  // Variance-based symmetry: 100 - variance(scores)
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

  return Math.round(100 - variance);
}

// ============================================================================
// BEST SET SELECTION
// ============================================================================

/**
 * Select the best working set from multiple sets
 * Returns the set with the highest estimated 1RM
 * 
 * @param {array} sets - Array of set objects with weight and reps
 * @returns {object} - Best set with estimated1RM added
 */
export function getBestWorkingSet(sets) {
  if (!sets || sets.length === 0) return null;
  
  // Calculate estimated 1RM for each set
  const setsWithE1RM = sets.map(set => ({
    ...set,
    estimated1RM: estimate1RM(set.weight, set.reps)
  }));
  
  // Return set with highest estimated 1RM
  return setsWithE1RM.reduce((best, current) => 
    current.estimated1RM > best.estimated1RM ? current : best
  );
}

/**
 * Get best set from each workout for progression tracking
 * 
 * @param {array} workouts - Array of workout objects with sets
 * @param {string} exerciseName - Name of exercise to analyze
 * @returns {array} - Array of best sets per workout
 */
export function getBestSetsFromWorkouts(workouts, exerciseName) {
  return workouts
    .map(workout => {
      // Filter sets for this exercise
      const exerciseSets = workout.sets.filter(
        set => normalizeExerciseName(set.exercise_name) === normalizeExerciseName(exerciseName)
      );
      
      if (exerciseSets.length === 0) return null;
      
      const bestSet = getBestWorkingSet(exerciseSets);
      return {
        workoutId: workout.id,
        date: workout.date,
        ...bestSet
      };
    })
    .filter(set => set !== null);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  estimate1RM,
  calculateWilks,
  getStrengthStandard,
  calculateSymmetryRatios,
  detectImbalances,
  calculateSymmetryScore,
  singleLiftStrengthScore,
  getBestWorkingSet,
  getBestSetsFromWorkouts,
  normalizeExerciseName
};