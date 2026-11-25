import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { get, all } from '../config/database.js';
import {
  estimate1RM,
  calculateWilks,
  getStrengthStandard,
  calculateSymmetryRatios,
  singleLiftStrengthScore,
  detectImbalances,
  calculateSymmetryScore,
  getBestWorkingSet
} from '../utils/strengthCalculations.js';
import {
  MAIN_LIFTS, findPRs, liftChange, muscleGroupSets, overviewFlags, overviewWindows, runningChange,
  summarizePRs, totals, trainingSummary,
} from '../services/strengthOverview.js';
import { Cardio } from '../models/index.js';
import { BestEfforts } from '../models/Analysis.js';

const router = express.Router();

/**
 * Helper function to convert units
 */
function convertToLbs(weight, units) {
  return units === 'kg' ? weight * 2.20462 : weight;
}

/** Pounds to the given units. */
function fromLbs(weight, units) {
  return units === 'kg' ? weight / 2.20462 : weight;
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
     ORDER BY date DESC, id DESC LIMIT 1`,
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
 * The user's today (the client's localDate when it's a valid YYYY-MM-DD,
 * else the server's UTC date) and the first day of the last `weeks` weeks.
 * weeks is clamped to 4–52, the range the app offers.
 */
function dateRange(req) {
  const localDate = req.query.localDate || '';
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(localDate) && !Number.isNaN(Date.parse(`${localDate}T00:00:00Z`));
  const endDateStr = valid ? localDate : new Date().toISOString().slice(0, 10);
  const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);
  const start = new Date(`${endDateStr}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - weeks * 7);
  return { weeks, endDateStr, startDateStr: start.toISOString().slice(0, 10) };
}

/** Sex for the formulas: 'F', or 'M' (also when not set). */
const formulaSex = (sex) => (sex === 'F' ? 'F' : 'M');

/**
 * Bodyweight in pounds on a date: the latest weigh-in on or before it, else
 * the earliest weigh-in after it, else the profile bodyweight (0 if none).
 */
function bodyweightLbsOn(userId, date, profile) {
  const log = get(
    'SELECT weight, units FROM bodyweight_logs WHERE user_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1',
    [userId, date]
  ) || get(
    'SELECT weight, units FROM bodyweight_logs WHERE user_id = ? AND date > ? ORDER BY date ASC, id ASC LIMIT 1',
    [userId, date]
  );
  if (log) return convertToLbs(log.weight, log.units);
  return convertToLbs(profile.bodyweight || 0, profile.units);
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
    const userId = req.user.id;
    const { weeks, startDateStr, endDateStr } = dateRange(req);

    // Get exercise ID
    const exerciseId = getExerciseIdByName(exerciseName);
    if (!exerciseId) {
      return res.status(404).json({
        error: `Exercise "${exerciseName}" not found`
      });
    }

    // Sets are logged in the user's units; Wilks wants kg and the standards pounds
    const user = get('SELECT sex, units, bodyweight FROM users WHERE id = ?', [userId]);
    const units = user.units === 'kg' ? 'kg' : 'lbs';
    const sex = formulaSex(user.sex);

    // Working sets that count toward a 1RM (no failed or empty sets)
    const workoutSets = all(
      `SELECT 
        w.id as workout_id,
        w.date,
        s.weight,
        s.reps
       FROM workouts w
       JOIN sets s ON w.id = s.workout_id
       WHERE w.user_id = ? 
         AND s.exercise_id = ?
         AND s.is_warmup = 0
         AND s.reps > 0
         AND s.weight > 0
         AND w.date >= ? 
         AND w.date <= ?
       ORDER BY w.date ASC, s.id ASC`,
      [userId, exerciseId, startDateStr, endDateStr]
    );
    
    if (workoutSets.length === 0) {
      return res.json({ 
        progression: [],
        units,
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
    
    // One point per workout, judged against the bodyweight at the time
    const bodyweightByDate = new Map();
    const progression = [];
    workoutMap.forEach((workout) => {
      const bestSet = getBestWorkingSet(workout.sets);
      if (!bestSet) return;

      if (!bodyweightByDate.has(workout.date)) {
        bodyweightByDate.set(workout.date, bodyweightLbsOn(userId, workout.date, user));
      }
      const bodyweightLbs = bodyweightByDate.get(workout.date);
      const estimated1RM = estimate1RM(bestSet.weight, bestSet.reps);
      const estimated1RMLbs = convertToLbs(estimated1RM, units);

      const wilksScore = calculateWilks(estimated1RMLbs / 2.20462, bodyweightLbs / 2.20462, sex);
      const standard = getStrengthStandard(exerciseName, bodyweightLbs, sex, estimated1RMLbs);

      progression.push({
        date: workout.date,
        estimated1RM: Math.round(estimated1RM * 10) / 10,
        weight: bestSet.weight,
        reps: bestSet.reps,
        wilksScore: Math.round(wilksScore * 10) / 10,
        standard: standard.level,
        percentile: standard.percentile
      });
    });
    
    res.json({ 
      progression,
      exerciseName,
      units,
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
    const userId = req.user.id;
    const { weeks, startDateStr, endDateStr } = dateRange(req);
    
    // Get user info
    const user = get('SELECT sex, units FROM users WHERE id = ?', [userId]);
    const units = user.units === 'kg' ? 'kg' : 'lbs';
    const bodyweightData = getUserBodyweight(userId);
    const bodyweightLbs = convertToLbs(bodyweightData.weight, bodyweightData.units);
    
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
        // Sets are logged in the user's units; the standards are in pounds
        const estimated1RM = estimate1RM(bestSet.weight, bestSet.reps);
        const standard = getStrengthStandard(
          lift.name,
          bodyweightLbs,
          formulaSex(user.sex),
          convertToLbs(estimated1RM, units)
        );
        const nextLevel = standard.nextLevel && {
          level: standard.nextLevel.level,
          weight: Math.round(fromLbs(standard.nextLevel.weight, units) * 10) / 10,
        };
        
        strengthScore[lift.key] = {
          estimated1RM: Math.round(estimated1RM * 10) / 10,
          standard: standard.level,
          percentile: standard.percentile,
          nextLevel,
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
      units,
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
    const { weeks, startDateStr, endDateStr } = dateRange(req);

    // Sets are logged in the user's units; the strength scores want pounds
    const user = get('SELECT sex, units FROM users WHERE id = ?', [userId]);
    const units = user.units === 'kg' ? 'kg' : 'lbs';
    const sex = formulaSex(user.sex);
    const bodyweightData = getUserBodyweight(userId);
    const bodyweightLbs = convertToLbs(bodyweightData.weight, bodyweightData.units);

    const mainLifts = [
      { name: 'Barbell Squat', key: 'squat' },
      { name: 'Barbell Bench Press', key: 'bench' },
      { name: 'Barbell Deadlift', key: 'deadlift' },
      { name: 'Barbell Overhead Press', key: 'ohp' }
    ];

    // Best estimated 1RM of each lift in the range, in pounds
    const lifts = {};
    mainLifts.forEach(lift => {
      const exerciseId = getExerciseIdByName(lift.name);
      const sets = exerciseId ? all(
        `SELECT s.weight, s.reps
         FROM sets s
         JOIN workouts w ON s.workout_id = w.id
         WHERE w.user_id = ?
           AND s.exercise_id = ?
           AND s.is_warmup = 0
           AND s.reps > 0
           AND s.weight > 0
           AND w.date >= ?
           AND w.date <= ?`,
        [userId, exerciseId, startDateStr, endDateStr]
      ) : [];
      const best = getBestWorkingSet(sets);
      lifts[lift.key] = best ? Math.round(convertToLbs(best.estimated1RM, units) * 10) / 10 : 0;
    });
    
    // Calculate ratios
    const ratios = calculateSymmetryRatios(lifts);
    
    // Detect imbalances
    const imbalances = detectImbalances(ratios, lifts);
    
    // Overall symmetry score: how evenly the lifts imply the same strength
    const overallScore = calculateSymmetryScore(lifts, sex, bodyweightLbs);
    const score = (key, name) => Math.round(singleLiftStrengthScore(sex, bodyweightLbs, lifts[key], name) * 10) / 10;
    
    res.json({
      ratios: {
        squatToDeadlift: Math.round(ratios.squatToDeadlift * 100) / 100,
        benchToSquat: Math.round(ratios.benchToSquat * 100) / 100,
        ohpToBench: Math.round(ratios.ohpToBench * 100) / 100,
        deadliftToSquat: Math.round(ratios.deadliftToSquat * 100) / 100
      },
      lifts: {
        squat: score('squat', 'Barbell Squat'),
        bench: score('bench', 'Barbell Bench Press'),
        deadlift: score('deadlift', 'Barbell Deadlift'),
        ohp: score('ohp', 'Barbell Overhead Press')
      },
      imbalances,
      overallScore,
      weeks,
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

// ---- Date helpers for the dashboard (all dates are 'YYYY-MM-DD', handled in UTC) ----
const DAY_MS = 24 * 60 * 60 * 1000;
const parseDay = (str) => {
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const formatDay = (ms) => new Date(ms).toISOString().slice(0, 10);
/** Sunday on or before the given day (weeks run Sunday–Saturday, like the rest of the app). */
const weekStartOf = (ms) => ms - new Date(ms).getUTCDay() * DAY_MS;

/**
 * GET /api/analytics/dashboard-summary
 *
 * Query: localDate (YYYY-MM-DD, the user's "today"), weeks (chart length, default 12)
 *
 * Returns totals, streaks, recent PRs, a weekly volume series and a daily
 * activity map for the dashboard.
 */
router.get('/dashboard-summary', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate || '')
      ? req.query.localDate
      : new Date().toISOString().slice(0, 10);
    const today = parseDay(todayStr);
    const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);
    const thisWeekStart = weekStartOf(today);

    const totalWorkouts = get('SELECT COUNT(*) as count FROM workouts WHERE user_id = ?', [userId]).count;

    // One row per workout day with counts
    const days = all(
      `SELECT date, COUNT(*) as count FROM workouts WHERE user_id = ? GROUP BY date ORDER BY date DESC`,
      [userId]
    );

    const thisWeek = days
      .filter((d) => parseDay(d.date) >= thisWeekStart && parseDay(d.date) <= today)
      .reduce((sum, d) => sum + d.count, 0);

    // Day streak: consecutive days ending today (or yesterday, so the streak
    // doesn't read 0 before today's session)
    let streak = 0;
    if (days.length > 0) {
      const latest = parseDay(days[0].date);
      if (today - latest <= DAY_MS) {
        streak = 1;
        for (let i = 1; i < days.length; i++) {
          if (parseDay(days[i - 1].date) - parseDay(days[i].date) === DAY_MS) streak++;
          else break;
        }
      }
    }

    // Week streak: consecutive weeks with at least one workout, ending this
    // week (or last week, if this week has none yet)
    const trainedWeeks = new Set(days.map((d) => weekStartOf(parseDay(d.date))));
    let weeklyStreak = 0;
    let cursor = trainedWeeks.has(thisWeekStart) ? thisWeekStart : thisWeekStart - 7 * DAY_MS;
    while (trainedWeeks.has(cursor)) {
      weeklyStreak++;
      cursor -= 7 * DAY_MS;
    }

    // Weekly volume (working sets only) for the chart
    const firstChartWeek = thisWeekStart - (weeks - 1) * 7 * DAY_MS;
    const volumeRows = all(
      `SELECT w.date, w.id as workout_id, SUM(CASE WHEN s.is_warmup = 0 THEN s.weight * s.reps ELSE 0 END) as volume,
              SUM(CASE WHEN s.is_warmup = 0 THEN 1 ELSE 0 END) as sets
       FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
       WHERE w.user_id = ? AND w.date >= ?
       GROUP BY w.id`,
      [userId, formatDay(firstChartWeek)]
    );
    const weekly = new Map();
    for (let i = 0; i < weeks; i++) {
      const start = firstChartWeek + i * 7 * DAY_MS;
      weekly.set(start, { weekStart: formatDay(start), volume: 0, workouts: 0, sets: 0 });
    }
    for (const row of volumeRows) {
      const bucket = weekly.get(weekStartOf(parseDay(row.date)));
      if (!bucket) continue;
      bucket.volume += Math.max(0, row.volume || 0);
      bucket.workouts += 1;
      bucket.sets += row.sets || 0;
    }
    const weeklyVolume = [...weekly.values()].map((w) => ({ ...w, volume: Math.round(w.volume) }));
    const volumeThisWeek = weeklyVolume[weeklyVolume.length - 1]?.volume ?? 0;
    const volumeLastWeek = weeklyVolume[weeklyVolume.length - 2]?.volume ?? 0;

    // Daily activity for the last 18 weeks (calendar heatmap)
    const activityStart = thisWeekStart - 17 * 7 * DAY_MS;
    const activity = days
      .filter((d) => parseDay(d.date) >= activityStart)
      .map((d) => ({ date: d.date, count: d.count }));

    // Recent PRs: a working set in the last 30 days whose estimated 1RM beats
    // every earlier set of that exercise
    const thirtyDaysAgo = formatDay(today - 30 * DAY_MS);
    const allSets = all(
      `SELECT w.date, w.id as workout_id, e.name as exercise, s.exercise_id, s.weight, s.reps
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       JOIN exercises e ON s.exercise_id = e.id
       WHERE w.user_id = ? AND s.is_warmup = 0 AND s.reps > 0 AND s.weight > 0
       ORDER BY w.date ASC, s.id ASC`,
      [userId]
    );
    const recentPRs = findPRs(allSets, thirtyDaysAgo)
      .sort((a, b) => b.date.localeCompare(a.date) || Number(a.firstTime) - Number(b.firstTime))
      .slice(0, 6);

    // Average per week since the first workout (at least one week)
    const firstDate = days.length ? parseDay(days[days.length - 1].date) : today;
    const weeksActive = Math.max(1, Math.ceil((today - weekStartOf(firstDate) + DAY_MS) / (7 * DAY_MS)));

    res.json({
      totalWorkouts,
      thisWeek,
      streak,
      weeklyStreak,
      volumeThisWeek,
      volumeLastWeek,
      weeklyVolume,
      activity,
      recentPRs,
      summary: {
        averageWorkoutsPerWeek: totalWorkouts > 0 ? Math.round((totalWorkouts / weeksActive) * 10) / 10 : 0,
        lastWorkoutDate: days.length > 0 ? days[0].date : null
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

/**
 * GET /api/analytics/overview
 * Query: localDate (YYYY-MM-DD, the user's today), weeks (4–52, default 12)
 *
 * How the last `weeks` weeks went compared with the `weeks` weeks before:
 * each main lift's best estimated 1RM and trend, total and DOTS, PRs,
 * sessions, volume and time, bodyweight, running fitness, weekly sets per
 * muscle group, and flags worth a look. Weights are in the user's units.
 * See services/strengthOverview.js.
 */
router.get('/overview', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate || '')
      ? req.query.localDate
      : new Date().toISOString().slice(0, 10);
    const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);
    const windows = overviewWindows(today, weeks);
    const { current, previous } = windows;

    const user = get('SELECT sex, units, bodyweight FROM users WHERE id = ?', [userId]);
    const units = user.units === 'kg' ? 'kg' : 'lbs';
    const sex = user.sex === 'F' ? 'F' : 'M';

    // Every working set, for PRs (which need the whole history) and the lifts
    const sets = all(
      `SELECT w.date, w.id as workout_id, e.name as exercise, s.exercise_id, s.weight, s.reps
       FROM sets s
       JOIN workouts w ON s.workout_id = w.id
       JOIN exercises e ON s.exercise_id = e.id
       WHERE w.user_id = ? AND s.is_warmup = 0 AND s.reps > 0 AND s.weight > 0 AND w.date <= ?
       ORDER BY w.date ASC, s.id ASC`,
      [userId, today]
    );

    const lifts = {};
    for (const lift of MAIN_LIFTS) {
      const exerciseId = getExerciseIdByName(lift.name);
      const liftSets = exerciseId ? sets.filter((s) => s.exercise_id === exerciseId && s.date >= previous.start) : [];
      lifts[lift.key] = { key: lift.key, name: lift.name, label: lift.label, ...liftChange(liftSets, windows, today) };
    }

    // Bodyweight at the end of each window, in the user's units
    const bodyweightOn = (date) => {
      const log = get(
        'SELECT weight, units FROM bodyweight_logs WHERE user_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1',
        [userId, date]
      );
      if (!log) return null;
      const lbs = convertToLbs(log.weight, log.units);
      return Math.round(fromLbs(lbs, units) * 10) / 10;
    };
    const profileWeight = user.bodyweight > 0 ? user.bodyweight : null;
    const bwCurrent = bodyweightOn(current.end) ?? profileWeight;
    const bwPrevious = bodyweightOn(previous.end);
    const bodyweight = {
      current: bwCurrent,
      previous: bwPrevious,
      change: bwCurrent && bwPrevious ? Math.round((bwCurrent - bwPrevious) * 10) / 10 : null,
    };

    const volumeRows = all(
      `SELECT w.id, SUM(s.weight * s.reps) as volume
       FROM workouts w JOIN sets s ON s.workout_id = w.id
       WHERE w.user_id = ? AND w.date >= ? AND w.date <= ? AND s.is_warmup = 0
       GROUP BY w.id`,
      [userId, previous.start, today]
    );
    const volumeByWorkout = new Map(volumeRows.map((r) => [r.id, r.volume || 0]));
    const summary = trainingSummary(Cardio.sessionsSince(userId, previous.start), volumeByWorkout, windows, weeks);

    const prs = findPRs(sets, previous.start);
    const muscleRows = all(
      `SELECT e.primary_muscle_group, e.secondary_muscle_groups
       FROM sets s
       JOIN exercises e ON s.exercise_id = e.id
       JOIN workouts w ON s.workout_id = w.id
       WHERE w.user_id = ? AND w.date >= ? AND w.date <= ? AND s.is_warmup = 0`,
      [userId, current.start, current.end]
    );
    const muscleGroups = muscleGroupSets(muscleRows, weeks);

    res.json({
      weeks,
      units,
      windows,
      summary,
      bodyweight,
      lifts,
      ...totals(lifts, bodyweight, units, sex),
      prs: { current: summarizePRs(prs, current), previous: summarizePRs(prs, previous) },
      running: runningChange(BestEfforts.forUser(userId), windows),
      muscleGroups,
      flags: overviewFlags({ lifts, muscleGroups, summary, weeks }),
    });
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ error: 'Failed to get the analytics overview' });
  }
});

export default router;
