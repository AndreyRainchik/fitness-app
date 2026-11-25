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
 * For assisted exercises (negative weight = assistance from machine):
 * Uses an inverted formula so the estimated 1RM is less negative (less
 * assistance required) than the working weight — reflecting that you need
 * less assistance to grind out a single max rep than to complete a full set.
 * When the 1RM reaches 0 the lifter can do an unassisted rep; once they log
 * positive (added) weight the standard formulas take over and the 1RM
 * continues to increase normally.
 *
 * @param {number} weight - Weight lifted (negative = machine assistance)
 * @param {number} reps - Number of reps completed
 * @returns {number} - Estimated 1RM
 */
export function estimate1RM(weight, reps) {
  // Validate inputs
  if (reps <= 0) return 0;
  if (reps === 1) return weight;

  if (weight < 0) {
    // Assisted exercise: invert the multiplier so the 1RM is less negative
    // (i.e. needs less assistance) than the working weight.
    if (reps >= 37) return weight / 2; // Safety fallback
    if (reps < 8) {
      return weight / (36 / (37 - reps));
    } else if (reps > 10) {
      return weight / (1 + reps / 30);
    } else {
      // Interpolate for 8-10 rep range
      const factor = (reps - 8) / 2;
      const brzyckiResult = weight / (36 / (37 - reps));
      const epleyResult = weight / (1 + reps / 30);
      return brzyckiResult * (1 - factor) + epleyResult * factor;
    }
  }

  // weight === 0 (unassisted bodyweight) or positive (added weight)
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

/**
 * DOTS score: a powerlifting total adjusted for bodyweight, so lifters of
 * different sizes (or one lifter across a bulk or cut) can be compared.
 * DOTS = total × 500 / (a + b·BW + c·BW² + d·BW³ + e·BW⁴), BW in kg and
 * clamped to the range the formula was fitted on.
 *
 * @param {number} totalKg - Squat + bench + deadlift (kg)
 * @param {number} bodyweightKg - Bodyweight (kg)
 * @param {string} sex - 'M' or 'F'
 * @returns {number} - DOTS score, or 0 without a total or bodyweight
 */
export function calculateDots(totalKg, bodyweightKg, sex) {
  if (!(totalKg > 0) || !(bodyweightKg > 0)) return 0;
  const female = sex === 'F';
  const [a, b, c, d, e] = female
    ? [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]
    : [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
  const bw = Math.min(Math.max(bodyweightKg, 40), female ? 150 : 210);
  const denominator = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;
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
 * Strength standards by exercise, sex and bodyweight class (lbs), as
 * published by StrengthLevel.com (strength-standards pages, data cutoff
 * March 2026; copied November 2026). Each level is the one-rep max that beats
 * that share of StrengthLevel's lifters: beginner 5%, novice 20%,
 * intermediate 50%, advanced 80%, elite 95%.
 *
 * Bodyweight classes are every 10 lb: men 110–310, women 90–260.
 * standardsAt() interpolates between them.
 */
const STRENGTH_STANDARDS = {
  'Barbell Squat': {
    M: {
      110: { beginner: 79, novice: 120, intermediate: 172, advanced: 234, elite: 301 },
      120: { beginner: 92, novice: 136, intermediate: 192, advanced: 257, elite: 327 },
      130: { beginner: 106, novice: 153, intermediate: 211, advanced: 279, elite: 352 },
      140: { beginner: 119, novice: 168, intermediate: 229, advanced: 300, elite: 376 },
      150: { beginner: 132, novice: 184, intermediate: 247, advanced: 320, elite: 399 },
      160: { beginner: 145, novice: 199, intermediate: 265, advanced: 340, elite: 421 },
      170: { beginner: 157, novice: 213, intermediate: 282, advanced: 359, elite: 442 },
      180: { beginner: 169, novice: 228, intermediate: 298, advanced: 377, elite: 462 },
      190: { beginner: 182, novice: 242, intermediate: 314, advanced: 395, elite: 482 },
      200: { beginner: 193, novice: 255, intermediate: 329, advanced: 413, elite: 501 },
      210: { beginner: 205, novice: 269, intermediate: 344, advanced: 430, elite: 520 },
      220: { beginner: 216, novice: 281, intermediate: 359, advanced: 446, elite: 538 },
      230: { beginner: 227, novice: 294, intermediate: 373, advanced: 462, elite: 555 },
      240: { beginner: 238, novice: 307, intermediate: 387, advanced: 477, elite: 572 },
      250: { beginner: 249, novice: 319, intermediate: 401, advanced: 493, elite: 589 },
      260: { beginner: 260, novice: 331, intermediate: 414, advanced: 507, elite: 605 },
      270: { beginner: 270, novice: 342, intermediate: 427, advanced: 522, elite: 621 },
      280: { beginner: 280, novice: 354, intermediate: 440, advanced: 536, elite: 636 },
      290: { beginner: 290, novice: 365, intermediate: 452, advanced: 550, elite: 651 },
      300: { beginner: 300, novice: 376, intermediate: 465, advanced: 563, elite: 666 },
      310: { beginner: 309, novice: 387, intermediate: 477, advanced: 576, elite: 680 },
    },
    F: {
      90: { beginner: 44, novice: 76, intermediate: 118, advanced: 170, elite: 228 },
      100: { beginner: 50, novice: 84, intermediate: 129, advanced: 183, elite: 243 },
      110: { beginner: 57, novice: 92, intermediate: 139, advanced: 194, elite: 256 },
      120: { beginner: 63, novice: 100, intermediate: 148, advanced: 206, elite: 269 },
      130: { beginner: 69, novice: 107, intermediate: 157, advanced: 216, elite: 281 },
      140: { beginner: 74, novice: 114, intermediate: 165, advanced: 226, elite: 292 },
      150: { beginner: 80, novice: 121, intermediate: 174, advanced: 235, elite: 303 },
      160: { beginner: 85, novice: 128, intermediate: 181, advanced: 244, elite: 313 },
      170: { beginner: 90, novice: 134, intermediate: 189, advanced: 253, elite: 323 },
      180: { beginner: 95, novice: 140, intermediate: 196, advanced: 261, elite: 332 },
      190: { beginner: 100, novice: 146, intermediate: 203, advanced: 269, elite: 341 },
      200: { beginner: 105, novice: 151, intermediate: 209, advanced: 277, elite: 350 },
      210: { beginner: 109, novice: 157, intermediate: 216, advanced: 284, elite: 358 },
      220: { beginner: 114, novice: 162, intermediate: 222, advanced: 291, elite: 366 },
      230: { beginner: 118, novice: 167, intermediate: 228, advanced: 298, elite: 374 },
      240: { beginner: 122, novice: 172, intermediate: 234, advanced: 305, elite: 381 },
      250: { beginner: 126, novice: 177, intermediate: 239, advanced: 311, elite: 389 },
      260: { beginner: 130, novice: 182, intermediate: 245, advanced: 318, elite: 396 },
    },
  },
  'Barbell Bench Press': {
    M: {
      110: { beginner: 60, novice: 90, intermediate: 128, advanced: 172, elite: 221 },
      120: { beginner: 70, novice: 102, intermediate: 142, advanced: 189, elite: 240 },
      130: { beginner: 80, novice: 114, intermediate: 156, advanced: 205, elite: 258 },
      140: { beginner: 89, novice: 125, intermediate: 170, advanced: 221, elite: 276 },
      150: { beginner: 99, novice: 137, intermediate: 183, advanced: 236, elite: 292 },
      160: { beginner: 108, novice: 148, intermediate: 196, advanced: 250, elite: 308 },
      170: { beginner: 118, novice: 158, intermediate: 208, advanced: 264, elite: 324 },
      180: { beginner: 127, novice: 169, intermediate: 220, advanced: 277, elite: 339 },
      190: { beginner: 136, novice: 179, intermediate: 231, advanced: 290, elite: 353 },
      200: { beginner: 144, novice: 189, intermediate: 243, advanced: 303, elite: 367 },
      210: { beginner: 153, novice: 199, intermediate: 254, advanced: 315, elite: 380 },
      220: { beginner: 161, novice: 208, intermediate: 265, advanced: 327, elite: 394 },
      230: { beginner: 169, novice: 218, intermediate: 275, advanced: 339, elite: 406 },
      240: { beginner: 177, novice: 227, intermediate: 285, advanced: 350, elite: 419 },
      250: { beginner: 185, novice: 236, intermediate: 295, advanced: 361, elite: 431 },
      260: { beginner: 193, novice: 244, intermediate: 305, advanced: 372, elite: 442 },
      270: { beginner: 200, novice: 253, intermediate: 314, advanced: 383, elite: 454 },
      280: { beginner: 208, novice: 261, intermediate: 324, advanced: 393, elite: 465 },
      290: { beginner: 215, novice: 269, intermediate: 333, advanced: 403, elite: 476 },
      300: { beginner: 222, novice: 278, intermediate: 342, advanced: 413, elite: 487 },
      310: { beginner: 229, novice: 285, intermediate: 351, advanced: 422, elite: 497 },
    },
    F: {
      90: { beginner: 23, novice: 44, intermediate: 73, advanced: 110, elite: 152 },
      100: { beginner: 27, novice: 50, intermediate: 81, advanced: 119, elite: 163 },
      110: { beginner: 32, novice: 56, intermediate: 88, advanced: 128, elite: 173 },
      120: { beginner: 36, novice: 61, intermediate: 95, advanced: 137, elite: 183 },
      130: { beginner: 40, novice: 67, intermediate: 102, advanced: 145, elite: 192 },
      140: { beginner: 44, novice: 72, intermediate: 108, advanced: 152, elite: 201 },
      150: { beginner: 48, novice: 77, intermediate: 114, advanced: 159, elite: 209 },
      160: { beginner: 52, novice: 82, intermediate: 120, advanced: 166, elite: 217 },
      170: { beginner: 55, novice: 86, intermediate: 126, advanced: 173, elite: 224 },
      180: { beginner: 59, novice: 91, intermediate: 131, advanced: 179, elite: 232 },
      190: { beginner: 63, novice: 95, intermediate: 136, advanced: 185, elite: 238 },
      200: { beginner: 66, novice: 99, intermediate: 141, advanced: 191, elite: 245 },
      210: { beginner: 69, novice: 103, intermediate: 146, advanced: 197, elite: 251 },
      220: { beginner: 73, novice: 107, intermediate: 151, advanced: 202, elite: 258 },
      230: { beginner: 76, novice: 111, intermediate: 156, advanced: 207, elite: 264 },
      240: { beginner: 79, novice: 115, intermediate: 160, advanced: 212, elite: 269 },
      250: { beginner: 82, novice: 119, intermediate: 164, advanced: 217, elite: 275 },
      260: { beginner: 85, novice: 122, intermediate: 168, advanced: 222, elite: 280 },
    },
  },
  'Barbell Deadlift': {
    M: {
      110: { beginner: 101, novice: 150, intermediate: 211, advanced: 283, elite: 361 },
      120: { beginner: 116, novice: 168, intermediate: 233, advanced: 308, elite: 389 },
      130: { beginner: 131, novice: 186, intermediate: 254, advanced: 332, elite: 416 },
      140: { beginner: 146, novice: 203, intermediate: 274, advanced: 355, elite: 442 },
      150: { beginner: 160, novice: 220, intermediate: 293, advanced: 377, elite: 466 },
      160: { beginner: 174, novice: 236, intermediate: 312, advanced: 398, elite: 490 },
      170: { beginner: 188, novice: 252, intermediate: 330, advanced: 419, elite: 513 },
      180: { beginner: 201, novice: 268, intermediate: 348, advanced: 438, elite: 535 },
      190: { beginner: 214, novice: 283, intermediate: 365, advanced: 458, elite: 556 },
      200: { beginner: 227, novice: 297, intermediate: 382, advanced: 476, elite: 576 },
      210: { beginner: 239, novice: 312, intermediate: 398, advanced: 494, elite: 596 },
      220: { beginner: 252, novice: 326, intermediate: 413, advanced: 512, elite: 615 },
      230: { beginner: 263, novice: 339, intermediate: 429, advanced: 529, elite: 634 },
      240: { beginner: 275, novice: 352, intermediate: 443, advanced: 545, elite: 652 },
      250: { beginner: 287, novice: 365, intermediate: 458, advanced: 561, elite: 669 },
      260: { beginner: 298, novice: 378, intermediate: 472, advanced: 577, elite: 686 },
      270: { beginner: 309, novice: 390, intermediate: 486, advanced: 592, elite: 703 },
      280: { beginner: 320, novice: 402, intermediate: 499, advanced: 607, elite: 719 },
      290: { beginner: 330, novice: 414, intermediate: 513, advanced: 622, elite: 735 },
      300: { beginner: 341, novice: 426, intermediate: 526, advanced: 636, elite: 751 },
      310: { beginner: 351, novice: 437, intermediate: 538, advanced: 650, elite: 766 },
    },
    F: {
      90: { beginner: 59, novice: 97, intermediate: 146, advanced: 205, elite: 270 },
      100: { beginner: 67, novice: 106, intermediate: 157, advanced: 218, elite: 286 },
      110: { beginner: 74, novice: 115, intermediate: 168, advanced: 231, elite: 300 },
      120: { beginner: 80, novice: 123, intermediate: 178, advanced: 242, elite: 313 },
      130: { beginner: 87, novice: 131, intermediate: 187, advanced: 253, elite: 326 },
      140: { beginner: 93, novice: 139, intermediate: 196, advanced: 264, elite: 338 },
      150: { beginner: 99, novice: 146, intermediate: 205, advanced: 274, elite: 349 },
      160: { beginner: 105, novice: 153, intermediate: 213, advanced: 283, elite: 359 },
      170: { beginner: 110, novice: 159, intermediate: 221, advanced: 292, elite: 370 },
      180: { beginner: 115, novice: 166, intermediate: 228, advanced: 301, elite: 379 },
      190: { beginner: 121, novice: 172, intermediate: 236, advanced: 309, elite: 389 },
      200: { beginner: 126, novice: 178, intermediate: 242, advanced: 317, elite: 397 },
      210: { beginner: 130, novice: 184, intermediate: 249, advanced: 325, elite: 406 },
      220: { beginner: 135, novice: 189, intermediate: 256, advanced: 332, elite: 414 },
      230: { beginner: 140, novice: 195, intermediate: 262, advanced: 339, elite: 422 },
      240: { beginner: 144, novice: 200, intermediate: 268, advanced: 346, elite: 430 },
      250: { beginner: 148, novice: 205, intermediate: 274, advanced: 353, elite: 437 },
      260: { beginner: 153, novice: 210, intermediate: 280, advanced: 359, elite: 445 },
    },
  },
  'Barbell Overhead Press': {
    M: {
      110: { beginner: 33, novice: 53, intermediate: 79, advanced: 111, elite: 147 },
      120: { beginner: 39, novice: 61, intermediate: 89, advanced: 123, elite: 160 },
      130: { beginner: 45, novice: 68, intermediate: 98, advanced: 133, elite: 172 },
      140: { beginner: 51, novice: 76, intermediate: 107, advanced: 144, elite: 183 },
      150: { beginner: 57, novice: 83, intermediate: 116, advanced: 154, elite: 195 },
      160: { beginner: 63, novice: 90, intermediate: 124, advanced: 163, elite: 206 },
      170: { beginner: 69, novice: 97, intermediate: 132, advanced: 172, elite: 216 },
      180: { beginner: 75, novice: 104, intermediate: 140, advanced: 181, elite: 226 },
      190: { beginner: 80, novice: 111, intermediate: 148, advanced: 190, elite: 236 },
      200: { beginner: 86, novice: 117, intermediate: 155, advanced: 199, elite: 245 },
      210: { beginner: 91, novice: 123, intermediate: 163, advanced: 207, elite: 254 },
      220: { beginner: 97, novice: 130, intermediate: 170, advanced: 215, elite: 263 },
      230: { beginner: 102, novice: 136, intermediate: 177, advanced: 223, elite: 272 },
      240: { beginner: 107, novice: 142, intermediate: 183, advanced: 230, elite: 280 },
      250: { beginner: 112, novice: 147, intermediate: 190, advanced: 238, elite: 288 },
      260: { beginner: 117, novice: 153, intermediate: 196, advanced: 245, elite: 296 },
      270: { beginner: 122, novice: 159, intermediate: 203, advanced: 252, elite: 304 },
      280: { beginner: 127, novice: 164, intermediate: 209, advanced: 259, elite: 312 },
      290: { beginner: 131, novice: 170, intermediate: 215, advanced: 266, elite: 319 },
      300: { beginner: 136, novice: 175, intermediate: 221, advanced: 272, elite: 326 },
      310: { beginner: 141, novice: 180, intermediate: 227, advanced: 279, elite: 333 },
    },
    F: {
      90: { beginner: 16, novice: 30, intermediate: 49, advanced: 73, elite: 100 },
      100: { beginner: 19, novice: 34, intermediate: 54, advanced: 79, elite: 107 },
      110: { beginner: 22, novice: 37, intermediate: 58, advanced: 84, elite: 113 },
      120: { beginner: 24, novice: 41, intermediate: 63, advanced: 89, elite: 118 },
      130: { beginner: 27, novice: 44, intermediate: 66, advanced: 94, elite: 124 },
      140: { beginner: 29, novice: 47, intermediate: 70, advanced: 98, elite: 129 },
      150: { beginner: 32, novice: 50, intermediate: 74, advanced: 102, elite: 134 },
      160: { beginner: 34, novice: 53, intermediate: 77, advanced: 106, elite: 138 },
      170: { beginner: 36, novice: 55, intermediate: 80, advanced: 110, elite: 143 },
      180: { beginner: 38, novice: 58, intermediate: 84, advanced: 114, elite: 147 },
      190: { beginner: 40, novice: 61, intermediate: 87, advanced: 117, elite: 151 },
      200: { beginner: 42, novice: 63, intermediate: 90, advanced: 121, elite: 155 },
      210: { beginner: 44, novice: 65, intermediate: 92, advanced: 124, elite: 158 },
      220: { beginner: 46, novice: 68, intermediate: 95, advanced: 127, elite: 162 },
      230: { beginner: 48, novice: 70, intermediate: 98, advanced: 130, elite: 165 },
      240: { beginner: 50, novice: 72, intermediate: 100, advanced: 133, elite: 169 },
      250: { beginner: 51, novice: 74, intermediate: 103, advanced: 136, elite: 172 },
      260: { beginner: 53, novice: 76, intermediate: 105, advanced: 139, elite: 175 },
    },
  },
};

/**
 * The standards for an exact bodyweight: interpolated linearly between the
 * two nearest bodyweight classes, and held at the lightest or heaviest class
 * outside the table. Returns null for an exercise without standards.
 */
function standardsAt(exerciseName, sex, bodyweightLbs) {
  const table = STRENGTH_STANDARDS[exerciseName]?.[sex === 'F' ? 'F' : 'M'];
  if (!table) return null;
  const classes = Object.keys(table).map(Number).sort((a, b) => a - b);
  const bw = Math.min(Math.max(Number(bodyweightLbs) || 0, classes[0]), classes[classes.length - 1]);
  const upper = classes.find((c) => c >= bw);
  const lower = [...classes].reverse().find((c) => c <= bw);
  if (upper === lower) return { ...table[upper] };
  const t = (bw - lower) / (upper - lower);
  const result = {};
  for (const level of Object.keys(table[lower])) {
    result[level] = Math.round(table[lower][level] + t * (table[upper][level] - table[lower][level]));
  }
  return result;
}

/**
 * Determine strength standard level for a given lift
 * 
 * @param {string} exerciseName - Name of exercise (must match STRENGTH_STANDARDS keys)
 * @param {number} bodyweightLbs - User's bodyweight in pounds
 * @param {string} sex - 'M' or 'F' (anything else uses the men's standards)
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
  
  const standards = standardsAt(normalizedName, sex, bodyweightLbs);

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