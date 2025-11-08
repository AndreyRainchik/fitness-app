import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, all } from '../config/database.js';
import {
  estimate1RM,
  calculateWilks,
  getStrengthStandard,
  calculateSymmetryRatios,
  detectImbalances,
  calculateSymmetryScore,
  getBestWorkingSet
} from '../utils/strengthCalculations.js';

const router = express.Router();

/**
 * Helper function to convert units
 */
function convertToLbs(weight, units) {
  return units === 'kg' ? weight * 2.20462 : weight;
}

/**
 * Helper function to get exercise ID by name
 */
function getExerciseIdByName(exerciseName) {
  // Try exact match first
  const exactMatch = get(
    'SELECT id FROM exercises WHERE LOWER(name) = LOWER(?)',
    [exerciseName]
  );
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  // Try partial match
  const partialMatch = get(
    'SELECT id FROM exercises WHERE LOWER(name) LIKE LOWER(?)',
    [`%${exerciseName}%`]
  );
  
  return partialMatch ? partialMatch.id : null;
}

/**
 * Helper function to get user's most recent bodyweight
 */
function getUserBodyweight(userId) {
  // Try to get latest bodyweight log
  const bodyweightLog = get(
    `SELECT weight, units FROM bodyweight_logs 
     WHERE user_id = ? 
     ORDER BY date DESC LIMIT 1`,
    [userId]
  );
  
  if (bodyweightLog) {
    return {
      weight: bodyweightLog.weight,
      units: bodyweightLog.units
    };
  }
  
  // Fallback to user profile bodyweight
  const user = get(
    'SELECT bodyweight, units FROM users WHERE id = ?',
    [userId]
  );
  
  return {
    weight: user.bodyweight || 0,
    units: user.units || 'lbs'
  };
}

/**
 * GET /api/analytics/lift-progression/:exerciseName
 * 
 * Returns progression data for a specific exercise over time
 * Query params: weeks (default: 12)
 * 
 * Response format:
 * [
 *   {
 *     date: '2025-11-01',
 *     estimated1RM: 315,
 *     weight: 275,
 *     reps: 5,
 *     wilksScore: 85.5,
 *     standard: 'Intermediate'
 *   },
 *   ...
 * ]
 */
router.get('/lift-progression/:exerciseName', authenticateToken, (req, res) => {
  try {
    const { exerciseName } = req.params;
    const weeks = parseInt(req.query.weeks) || 12;
    const userId = req.user.id;
    
    // Get exercise ID
    const exerciseId = getExerciseIdByName(exerciseName);
    if (!exerciseId) {
      return res.status(404).json({ 
        error: `Exercise "${exerciseName}" not found` 
      });
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Get user info for Wilks and standards
    const user = get('SELECT sex, units FROM users WHERE id = ?', [userId]);
    const bodyweightData = getUserBodyweight(userId);
    const bodyweightLbs = convertToLbs(bodyweightData.weight, bodyweightData.units);
    const bodyweightKg = bodyweightData.units === 'kg' ? 
      bodyweightData.weight : 
      bodyweightData.weight / 2.20462;
    
    // Get all workouts with sets for this exercise in date range
    const workoutSets = all(
      `SELECT 
        w.id as workout_id,
        w.date,
        s.id as set_id,
        s.weight,
        s.reps,
        s.is_warmup
       FROM workouts w
       JOIN sets s ON w.id = s.workout_id
       WHERE w.user_id = ? 
         AND s.exercise_id = ?
         AND s.is_warmup = 0
         AND w.date >= ? 
         AND w.date <= ?
       ORDER BY w.date ASC, s.id ASC`,
      [userId, exerciseId, startDateStr, endDateStr]
    );
    
    if (workoutSets.length === 0) {
      return res.json({ 
        progression: [],
        message: `No data found for ${exerciseName} in the last ${weeks} weeks`
      });
    }
    
    // Group sets by workout
    const workoutMap = new Map();
    workoutSets.forEach(set => {
      if (!workoutMap.has(set.workout_id)) {
        workoutMap.set(set.workout_id, {
          date: set.date,
          sets: []
        });
      }
      workoutMap.get(set.workout_id).sets.push({
        weight: set.weight,
        reps: set.reps
      });
    });
    
    // Calculate progression data for each workout
    const progression = [];
    workoutMap.forEach((workout, workoutId) => {
      // Get best set from this workout
      const bestSet = getBestWorkingSet(workout.sets);
      
      if (bestSet) {
        const estimated1RM = estimate1RM(bestSet.weight, bestSet.reps);
        
        // Calculate Wilks score
        const estimated1RMKg = estimated1RM / 2.20462;
        const wilksScore = calculateWilks(estimated1RMKg, bodyweightKg, user.sex || 'M');
        
        // Get strength standard
        const standard = getStrengthStandard(
          exerciseName,
          bodyweightLbs,
          user.sex || 'M',
          estimated1RM
        );
        
        progression.push({
          date: workout.date,
          estimated1RM: Math.round(estimated1RM * 10) / 10,
          weight: bestSet.weight,
          reps: bestSet.reps,
          wilksScore: Math.round(wilksScore * 10) / 10,
          standard: standard.level,
          percentile: standard.percentile
        });
      }
    });
    
    res.json({ 
      progression,
      exerciseName,
      weeks,
      dataPoints: progression.length
    });
    
  } catch (error) {
    console.error('Lift progression error:', error);
    res.status(500).json({ error: 'Failed to get lift progression data' });
  }
});

/**
 * GET /api/analytics/strength-score
 * 
 * Returns summary of all main lifts (squat, bench, deadlift, OHP)
 * Query params: weeks (default: 12)
 * 
 * Response format:
 * {
 *   squat: {
 *     estimated1RM: 315,
 *     standard: 'Intermediate',
 *     percentile: 70,
 *     recentPR: { weight: 275, reps: 5, date: '2025-11-01' }
 *   },
 *   bench: { ... },
 *   deadlift: { ... },
 *   ohp: { ... }
 * }
 */
router.get('/strength-score', authenticateToken, (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 12;
    const userId = req.user.id;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Get user info
    const user = get('SELECT sex, units FROM users WHERE id = ?', [userId]);
    const bodyweightData = getUserBodyweight(userId);
    const bodyweightLbs = convertToLbs(bodyweightData.weight, bodyweightData.units);
    const bodyweightKg = bodyweightData.units === 'kg' ? 
      bodyweightData.weight : 
      bodyweightData.weight / 2.20462;
    
    // Main lifts to analyze
    const mainLifts = [
      { name: 'Barbell Squat', key: 'squat' },
      { name: 'Barbell Bench Press', key: 'bench' },
      { name: 'Barbell Deadlift', key: 'deadlift' },
      { name: 'Barbell Overhead Press', key: 'ohp' }
    ];
    
    const strengthScore = {};
    
    // Analyze each main lift
    mainLifts.forEach(lift => {
      const exerciseId = getExerciseIdByName(lift.name);
      
      if (!exerciseId) {
        strengthScore[lift.key] = {
          estimated1RM: 0,
          standard: 'No Data',
          percentile: 0,
          recentPR: null
        };
        return;
      }
      
      // Get best set from recent weeks
      const recentSets = all(
        `SELECT 
          w.date,
          s.weight,
          s.reps
         FROM workouts w
         JOIN sets s ON w.id = s.workout_id
         WHERE w.user_id = ? 
           AND s.exercise_id = ?
           AND s.is_warmup = 0
           AND w.date >= ? 
           AND w.date <= ?
         ORDER BY w.date DESC`,
        [userId, exerciseId, startDateStr, endDateStr]
      );
      
      if (recentSets.length === 0) {
        strengthScore[lift.key] = {
          estimated1RM: 0,
          standard: 'No Data',
          percentile: 0,
          recentPR: null
        };
        return;
      }
      
      // Find best set (highest estimated 1RM)
      let bestSet = null;
      let maxE1RM = 0;
      
      recentSets.forEach(set => {
        const e1rm = estimate1RM(set.weight, set.reps);
        if (e1rm > maxE1RM) {
          maxE1RM = e1rm;
          bestSet = set;
        }
      });
      
      if (bestSet) {
        const estimated1RM = estimate1RM(bestSet.weight, bestSet.reps);
        const standard = getStrengthStandard(
          lift.name,
          bodyweightLbs,
          user.sex || 'M',
          estimated1RM
        );
        
        strengthScore[lift.key] = {
          estimated1RM: Math.round(estimated1RM * 10) / 10,
          standard: standard.level,
          percentile: standard.percentile,
          nextLevel: standard.nextLevel,
          recentPR: {
            weight: bestSet.weight,
            reps: bestSet.reps,
            date: bestSet.date
          }
        };
      }
    });
    
    // Calculate total if all lifts present
    const total = 
      (strengthScore.squat?.estimated1RM || 0) +
      (strengthScore.bench?.estimated1RM || 0) +
      (strengthScore.deadlift?.estimated1RM || 0);
    
    res.json({
      ...strengthScore,
      total: Math.round(total * 10) / 10,
      weeks,
      bodyweight: {
        value: bodyweightData.weight,
        units: bodyweightData.units
      }
    });
    
  } catch (error) {
    console.error('Strength score error:', error);
    res.status(500).json({ error: 'Failed to calculate strength score' });
  }
});

/**
 * GET /api/analytics/symmetry
 * 
 * Analyzes balance/symmetry between main lifts
 * 
 * Response format:
 * {
 *   ratios: {
 *     squatToDeadlift: 0.85,
 *     benchToSquat: 0.70,
 *     ohpToBench: 0.625
 *   },
 *   imbalances: [
 *     {
 *       type: 'weakness',
 *       severity: 'medium',
 *       lift: 'Squat',
 *       message: '...',
 *       suggestion: '...'
 *     }
 *   ],
 *   overallScore: 85
 * }
 */
router.get('/symmetry', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user info
    const user = get('SELECT sex, units FROM users WHERE id = ?', [userId]);
    const bodyweightData = getUserBodyweight(userId);
    const bodyweightLbs = convertToLbs(bodyweightData.weight, bodyweightData.units);
    
    // Get latest estimated 1RMs for all main lifts
    const mainLifts = [
      { name: 'Barbell Squat', key: 'squat' },
      { name: 'Barbell Bench Press', key: 'bench' },
      { name: 'Barbell Deadlift', key: 'deadlift' },
      { name: 'Barbell Overhead Press', key: 'ohp' }
    ];
    
    const lifts = {};
    
    mainLifts.forEach(lift => {
      const exerciseId = getExerciseIdByName(lift.name);
      
      if (!exerciseId) {
        lifts[lift.key] = 0;
        return;
      }
      
      // Get all-time best set
      const bestSet = get(
        `SELECT s.weight, s.reps
         FROM sets s
         JOIN workouts w ON s.workout_id = w.id
         WHERE w.user_id = ? 
           AND s.exercise_id = ?
           AND s.is_warmup = 0
         ORDER BY s.weight DESC, s.reps DESC
         LIMIT 1`,
        [userId, exerciseId]
      );
      
      if (bestSet) {
        lifts[lift.key] = estimate1RM(bestSet.weight, bestSet.reps);
      } else {
        lifts[lift.key] = 0;
      }
    });
    
    // Calculate ratios
    const ratios = calculateSymmetryRatios(lifts);
    
    // Detect imbalances
    const imbalances = detectImbalances(ratios, lifts);
    
    // Calculate overall symmetry score
    const overallScore = calculateSymmetryScore(ratios);
    
    res.json({
      ratios: {
        squatToDeadlift: Math.round(ratios.squatToDeadlift * 100) / 100,
        benchToSquat: Math.round(ratios.benchToSquat * 100) / 100,
        ohpToBench: Math.round(ratios.ohpToBench * 100) / 100,
        deadliftToSquat: Math.round(ratios.deadliftToSquat * 100) / 100
      },
      lifts: {
        squat: Math.round(lifts.squat * 10) / 10,
        bench: Math.round(lifts.bench * 10) / 10,
        deadlift: Math.round(lifts.deadlift * 10) / 10,
        ohp: Math.round(lifts.ohp * 10) / 10
      },
      imbalances,
      overallScore,
      interpretation: overallScore >= 85 ? 'Excellent balance' :
                      overallScore >= 70 ? 'Good balance' :
                      overallScore >= 50 ? 'Fair balance - some work needed' :
                      'Significant imbalances detected'
    });
    
  } catch (error) {
    console.error('Symmetry analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze symmetry' });
  }
});

/**
 * GET /api/analytics/dashboard-summary
 * 
 * Returns summary stats for dashboard display
 * 
 * Response format:
 * {
 *   totalWorkouts: 145,
 *   thisWeek: 3,
 *   streak: 5,
 *   recentPRs: [
 *     {
 *       exercise: 'Barbell Squat',
 *       weight: 315,
 *       reps: 5,
 *       date: '2025-11-01',
 *       estimated1RM: 354
 *     }
 *   ]
 * }
 */
router.get('/dashboard-summary', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total workouts
    const totalResult = get(
      'SELECT COUNT(*) as count FROM workouts WHERE user_id = ?',
      [userId]
    );
    const totalWorkouts = totalResult.count;
    
    // Get this week's workouts
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    
    const weekResult = get(
      `SELECT COUNT(*) as count FROM workouts 
       WHERE user_id = ? AND date >= ?`,
      [userId, startOfWeekStr]
    );
    const thisWeek = weekResult.count;
    
    // Calculate workout streak (consecutive days with workouts)
    const recentWorkouts = all(
      `SELECT DISTINCT date FROM workouts 
       WHERE user_id = ? 
       ORDER BY date DESC 
       LIMIT 30`,
      [userId]
    );
    
    let streak = 0;
    if (recentWorkouts.length > 0) {
      const dates = recentWorkouts.map(w => new Date(w.date));
      streak = 1;
      
      for (let i = 0; i < dates.length - 1; i++) {
        const daysDiff = Math.floor(
          (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    // Get recent PRs (personal records from last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Get all sets from last 30 days with exercise info
    const recentSets = all(
      `SELECT 
        w.date,
        e.name as exercise,
        s.weight,
        s.reps,
        s.exercise_id
       FROM workouts w
       JOIN sets s ON w.id = s.workout_id
       JOIN exercises e ON s.exercise_id = e.id
       WHERE w.user_id = ? 
         AND s.is_warmup = 0
         AND w.date >= ?
       ORDER BY w.date DESC`,
      [userId, thirtyDaysAgoStr]
    );
    
    // Find PRs by comparing with historical bests
    const prMap = new Map();
    
    recentSets.forEach(set => {
      const e1rm = estimate1RM(set.weight, set.reps);
      
      // Check if this is a PR compared to earlier history
      const historicalBest = get(
        `SELECT MAX(s.weight) as max_weight, s.reps
         FROM sets s
         JOIN workouts w ON s.workout_id = w.id
         WHERE w.user_id = ? 
           AND s.exercise_id = ?
           AND s.is_warmup = 0
           AND w.date < ?
         ORDER BY s.weight DESC
         LIMIT 1`,
        [userId, set.exercise_id, set.date]
      );
      
      let isPR = false;
      if (!historicalBest || !historicalBest.max_weight) {
        // First time doing this exercise
        isPR = true;
      } else {
        const historicalE1RM = estimate1RM(
          historicalBest.max_weight, 
          historicalBest.reps
        );
        isPR = e1rm > historicalE1RM;
      }
      
      if (isPR) {
        const key = `${set.exercise_id}-${set.date}`;
        if (!prMap.has(key) || e1rm > estimate1RM(prMap.get(key).weight, prMap.get(key).reps)) {
          prMap.set(key, {
            exercise: set.exercise,
            weight: set.weight,
            reps: set.reps,
            date: set.date,
            estimated1RM: Math.round(e1rm * 10) / 10
          });
        }
      }
    });
    
    // Convert to array and sort by date (most recent first)
    const recentPRs = Array.from(prMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // Top 5 most recent PRs
    
    res.json({
      totalWorkouts,
      thisWeek,
      streak,
      recentPRs,
      summary: {
        averageWorkoutsPerWeek: totalWorkouts > 0 ? 
          Math.round((totalWorkouts / 52) * 10) / 10 : 0,
        lastWorkoutDate: recentWorkouts.length > 0 ? 
          recentWorkouts[0].date : null
      }
    });
    
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

/**
 * GET /api/analytics/muscle-groups-weekly
 * 
 * Returns set counts per muscle group for a specific week
 * Query params: date (ISO date string for any day in target week)
 * 
 * Response format:
 * {
 *   weekStart: '2025-11-03',
 *   weekEnd: '2025-11-09',
 *   muscleGroups: [
 *     { muscleGroup: 'Chest', setCount: 12 },
 *     { muscleGroup: 'Back', setCount: 8 }
 *   ],
 *   totalSets: 20
 * }
 */
router.get('/muscle-groups-weekly', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;
    
    // Parse the date or use current date
    const targetDate = date ? new Date(date) : new Date();
    
    // Calculate start of week (Sunday) and end of week (Saturday)
    const dayOfWeek = targetDate.getDay();
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startDateStr = startOfWeek.toISOString().split('T')[0];
    const endDateStr = endOfWeek.toISOString().split('T')[0];
    
    // Query to get all sets with exercise info for the week
    const rows = all(
      `SELECT 
        e.primary_muscle_group,
        e.secondary_muscle_groups,
        s.id as set_id
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       JOIN workouts w ON s.workout_id = w.id
       WHERE w.user_id = ?
         AND w.date >= ?
         AND w.date <= ?
         AND s.is_warmup = 0`,
      [userId, startDateStr, endDateStr]
    );
    
    // Aggregate muscle group counts
    const muscleGroupCounts = {};
    
    rows.forEach(row => {
      // Count primary muscle
      if (row.primary_muscle_group) {
        muscleGroupCounts[row.primary_muscle_group] = 
          (muscleGroupCounts[row.primary_muscle_group] || 0) + 1;
      }
      
      // Count secondary muscles (if any)
      if (row.secondary_muscle_groups) {
        const secondaryMuscles = row.secondary_muscle_groups.split(',').map(m => m.trim().replaceAll('\"','').replaceAll('[','').replaceAll(']',''));
        secondaryMuscles.forEach(muscle => {
          if (muscle) {
            // Secondary muscles count as 0.5 sets
            muscleGroupCounts[muscle] = 
              (muscleGroupCounts[muscle] || 0) + 0.5;
          }
        });
      }
    });
    
    // Convert to array format
    const muscleGroups = Object.keys(muscleGroupCounts).map(muscle => ({
      muscleGroup: muscle,
      setCount: Math.round(muscleGroupCounts[muscle])
    }));
    
    res.json({
      weekStart: startDateStr,
      weekEnd: endDateStr,
      muscleGroups,
      totalSets: muscleGroups.reduce((sum, m) => sum + m.setCount, 0)
    });
    
  } catch (error) {
    console.error('Error fetching weekly muscle groups:', error);
    res.status(500).json({ error: 'Failed to fetch muscle group data' });
  }
});

export default router;