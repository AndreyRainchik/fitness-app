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
      130: { beginner: 75, novice: 138, intermediate: 166, advanced: 230, elite: 307 },
      140: { beginner: 84, novice: 156, intermediate: 190, advanced: 264, elite: 354 },
      150: { beginner: 94, novice: 174, intermediate: 213, advanced: 297, elite: 399 },
      160: { beginner: 103, novice: 192, intermediate: 236, advanced: 329, elite: 443 },
      170: { beginner: 113, novice: 209, intermediate: 258, advanced: 361, elite: 486 },
      180: { beginner: 122, novice: 227, intermediate: 280, advanced: 392, elite: 528 },
      190: { beginner: 131, novice: 244, intermediate: 302, advanced: 423, elite: 570 },
      200: { beginner: 140, novice: 261, intermediate: 324, advanced: 453, elite: 611 },
      210: { beginner: 149, novice: 278, intermediate: 345, advanced: 483, elite: 651 },
      220: { beginner: 158, novice: 294, intermediate: 366, advanced: 513, elite: 691 },
      230: { beginner: 167, novice: 311, intermediate: 387, advanced: 542, elite: 731 },
      240: { beginner: 175, novice: 327, intermediate: 408, advanced: 571, elite: 770 },
      250: { beginner: 184, novice: 343, intermediate: 428, advanced: 600, elite: 809 },
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
      130: { beginner: 61, novice: 92, intermediate: 107, advanced: 144, elite: 188 },
      140: { beginner: 68, novice: 103, intermediate: 121, advanced: 163, elite: 213 },
      150: { beginner: 76, novice: 115, intermediate: 135, advanced: 183, elite: 239 },
      160: { beginner: 84, novice: 127, intermediate: 149, advanced: 203, elite: 265 },
      170: { beginner: 91, novice: 138, intermediate: 163, advanced: 222, elite: 290 },
      180: { beginner: 99, novice: 150, intermediate: 178, advanced: 242, elite: 316 },
      190: { beginner: 107, novice: 162, intermediate: 192, advanced: 261, elite: 342 },
      200: { beginner: 114, novice: 173, intermediate: 206, advanced: 280, elite: 367 },
      210: { beginner: 122, novice: 185, intermediate: 220, advanced: 300, elite: 392 },
      220: { beginner: 129, novice: 196, intermediate: 234, advanced: 319, elite: 417 },
      230: { beginner: 137, novice: 208, intermediate: 248, advanced: 337, elite: 442 },
      240: { beginner: 144, novice: 219, intermediate: 261, advanced: 356, elite: 467 },
      250: { beginner: 151, novice: 230, intermediate: 275, advanced: 374, elite: 491 },
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
      130: { beginner: 97, novice: 174, intermediate: 209, advanced: 284, elite: 371 },
      140: { beginner: 109, novice: 196, intermediate: 238, advanced: 325, elite: 425 },
      150: { beginner: 121, novice: 218, intermediate: 266, advanced: 365, elite: 479 },
      160: { beginner: 133, novice: 240, intermediate: 294, advanced: 405, elite: 532 },
      170: { beginner: 144, novice: 261, intermediate: 322, advanced: 444, elite: 584 },
      180: { beginner: 156, novice: 282, intermediate: 349, advanced: 483, elite: 636 },
      190: { beginner: 167, novice: 303, intermediate: 376, advanced: 521, elite: 687 },
      200: { beginner: 179, novice: 324, intermediate: 403, advanced: 559, elite: 738 },
      210: { beginner: 190, novice: 344, intermediate: 429, advanced: 596, elite: 788 },
      220: { beginner: 201, novice: 365, intermediate: 455, advanced: 633, elite: 838 },
      230: { beginner: 212, novice: 385, intermediate: 481, advanced: 670, elite: 887 },
      240: { beginner: 223, novice: 405, intermediate: 506, advanced: 706, elite: 936 },
      250: { beginner: 234, novice: 425, intermediate: 532, advanced: 742, elite: 984 },
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
      130: { beginner: 41, novice: 62, intermediate: 73, advanced: 98, elite: 128 },
      140: { beginner: 46, novice: 70, intermediate: 83, advanced: 111, elite: 145 },
      150: { beginner: 51, novice: 78, intermediate: 92, advanced: 125, elite: 163 },
      160: { beginner: 57, novice: 86, intermediate: 102, advanced: 138, elite: 181 },
      170: { beginner: 62, novice: 94, intermediate: 112, advanced: 152, elite: 198 },
      180: { beginner: 67, novice: 102, intermediate: 121, advanced: 165, elite: 216 },
      190: { beginner: 72, novice: 110, intermediate: 131, advanced: 178, elite: 233 },
      200: { beginner: 77, novice: 118, intermediate: 140, advanced: 191, elite: 251 },
      210: { beginner: 82, novice: 125, intermediate: 149, advanced: 204, elite: 268 },
      220: { beginner: 88, novice: 133, intermediate: 159, advanced: 217, elite: 285 },
      230: { beginner: 93, novice: 141, intermediate: 168, advanced: 229, elite: 301 },
      240: { beginner: 98, novice: 148, intermediate: 177, advanced: 242, elite: 318 },
      250: { beginner: 103, novice: 156, intermediate: 186, advanced: 254, elite: 334 },
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
  
  // Determine level
  let level = 'Untrained';
  let percentile = 0;
  let nextLevel = null;
  
  if (estimated1RM >= standards.elite) {
    level = 'Elite';
    percentile = 99;
  } else if (estimated1RM >= standards.advanced) {
    level = 'Advanced';
    percentile = 90;
    nextLevel = { level: 'Elite', weight: standards.elite };
  } else if (estimated1RM >= standards.intermediate) {
    level = 'Intermediate';
    percentile = 70;
    nextLevel = { level: 'Advanced', weight: standards.advanced };
  } else if (estimated1RM >= standards.novice) {
    level = 'Novice';
    percentile = 50;
    nextLevel = { level: 'Intermediate', weight: standards.intermediate };
  } else if (estimated1RM >= standards.beginner) {
    level = 'Beginner';
    percentile = 25;
    nextLevel = { level: 'Novice', weight: standards.novice };
  } else {
    level = 'Untrained';
    percentile = 10;
    nextLevel = { level: 'Beginner', weight: standards.beginner };
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
 * Calculate overall symmetry score (0-100)
 * 
 * @param {object} ratios - Calculated ratios
 * @returns {number} - Score from 0 to 100
 */
export function calculateSymmetryScore(ratios) {
  let totalScore = 0;
  let count = 0;
  
  // Score each ratio
  for (const [key, value] of Object.entries(ratios)) {
    if (value > 0 && IDEAL_RATIOS[key]) {
      const { min, max, ideal } = IDEAL_RATIOS[key];
      
      // Calculate how close to ideal (0 = at boundaries, 100 = perfect)
      let score;
      if (value >= min && value <= max) {
        // Within acceptable range
        const distanceFromIdeal = Math.abs(value - ideal);
        const rangeSize = (max - min) / 2;
        score = 100 * (1 - distanceFromIdeal / rangeSize);
      } else {
        // Outside acceptable range
        const distanceOutside = value < min ? min - value : value - max;
        score = Math.max(0, 50 - distanceOutside * 50);
      }
      
      totalScore += score;
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalScore / count) : 0;
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
  getBestWorkingSet,
  getBestSetsFromWorkouts,
  normalizeExerciseName
};