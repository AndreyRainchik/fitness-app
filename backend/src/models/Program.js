import { get, all, run } from '../config/database.js';

/**
 * Program Model
 * Handles training program management (5/3/1, Starting Strength, custom programs, etc.)
 */
class Program {
  /**
   * Create a new program
   */
  static create({ user_id, name, type, start_date, current_week = 1, current_cycle = 1, is_active = 1 }) {
    // Deactivate other programs for this user if this one is active
    if (is_active) {
      run('UPDATE programs SET is_active = 0 WHERE user_id = ?', [user_id]);
    }
    
    run(
      `INSERT INTO programs (user_id, name, type, start_date, current_week, current_cycle, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, name, type, start_date, current_week, current_cycle, is_active ? 1 : 0]
    );
    
    // Get the created program
    return get(
      'SELECT * FROM programs WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );
  }
  
  /**
   * Get program by ID
   */
  static findById(id) {
    return get('SELECT * FROM programs WHERE id = ?', [id]);
  }
  
  /**
   * Get active program for a user
   */
  static getActiveByUser(user_id) {
    return get(
      'SELECT * FROM programs WHERE user_id = ? AND is_active = 1',
      [user_id]
    );
  }
  
  /**
   * Get all programs for a user
   */
  static getByUser(user_id) {
    return all(
      'SELECT * FROM programs WHERE user_id = ? ORDER BY is_active DESC, start_date DESC',
      [user_id]
    );
  }
  
  /**
   * Get program with all lifts
   */
  static getWithLifts(id) {
    const program = this.findById(id);
    if (!program) {
      return null;
    }
    
    const lifts = all(
      `SELECT pl.*, e.name as exercise_name, e.category, e.primary_muscle_group
       FROM program_lifts pl
       JOIN exercises e ON pl.exercise_id = e.id
       WHERE pl.program_id = ?`,
      [id]
    );
    
    program.lifts = lifts;
    return program;
  }
  
  /**
   * Update program
   */
  static update(id, { name, current_week, current_cycle, is_active }) {
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (current_week !== undefined) {
      updates.push('current_week = ?');
      params.push(current_week);
    }
    if (current_cycle !== undefined) {
      updates.push('current_cycle = ?');
      params.push(current_cycle);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
      
      // Deactivate other programs if this one is being activated
      if (is_active) {
        const program = this.findById(id);
        if (program) {
          run(
            'UPDATE programs SET is_active = 0 WHERE user_id = ? AND id != ?',
            [program.user_id, id]
          );
        }
      }
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    run(
      `UPDATE programs SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete program (cascades to program_lifts)
   */
  static delete(id) {
    run('DELETE FROM programs WHERE id = ?', [id]);
    return { success: true };
  }
  
  /**
   * Add lift to program
   */
  static addLift(program_id, exercise_id, training_max) {
    run(
      `INSERT INTO program_lifts (program_id, exercise_id, training_max)
       VALUES (?, ?, ?)`,
      [program_id, exercise_id, training_max]
    );
    
    return get(
      'SELECT * FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
  }
  
  /**
   * Update training max for a lift (or current weight for Starting Strength)
   */
  static updateLift(program_id, exercise_id, training_max) {
    run(
      `UPDATE program_lifts 
       SET training_max = ?, last_updated = CURRENT_TIMESTAMP 
       WHERE program_id = ? AND exercise_id = ?`,
      [training_max, program_id, exercise_id]
    );
    
    return get(
      'SELECT * FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
  }
  
  /**
   * Get lift from program
   */
  static getLift(program_id, exercise_id) {
    return get(
      `SELECT pl.*, e.name as exercise_name
       FROM program_lifts pl
       JOIN exercises e ON pl.exercise_id = e.id
       WHERE pl.program_id = ? AND pl.exercise_id = ?`,
      [program_id, exercise_id]
    );
  }
  
  /**
   * Remove lift from program
   */
  static removeLift(program_id, exercise_id) {
    run(
      'DELETE FROM program_lifts WHERE program_id = ? AND exercise_id = ?',
      [program_id, exercise_id]
    );
    return { success: true };
  }
  
  // =====================================================
  // NEW: LIFT STATUS TRACKING METHODS
  // =====================================================
  
  /**
   * Set status for a lift in a specific week/cycle
   * @param {number} program_id - Program ID
   * @param {number} exercise_id - Exercise ID
   * @param {number} week - Week number
   * @param {number} cycle - Cycle number
   * @param {string} status - Status: 'completed', 'failed', or 'skipped'
   * @param {string} notes - Optional notes
   * @returns {Object} The created/updated status record
   */
  static setLiftStatus(program_id, exercise_id, week, cycle, status, notes = null, amrap_reps = null) {
    // Validate status
    const validStatuses = ['completed', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Use UPSERT (INSERT OR REPLACE) to handle both new and existing records
    run(
      `INSERT INTO program_lift_status (program_id, exercise_id, week, cycle, status, notes, amrap_reps, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(program_id, exercise_id, week, cycle)
       DO UPDATE SET
         status = excluded.status,
         notes = excluded.notes,
         amrap_reps = excluded.amrap_reps,
         updated_at = CURRENT_TIMESTAMP`,
      [program_id, exercise_id, week, cycle, status, notes, amrap_reps]
    );
    
    return get(
      `SELECT * FROM program_lift_status 
       WHERE program_id = ? AND exercise_id = ? AND week = ? AND cycle = ?`,
      [program_id, exercise_id, week, cycle]
    );
  }
  
  /**
   * Get status for a specific lift in a specific week/cycle
   * @param {number} program_id - Program ID
   * @param {number} exercise_id - Exercise ID
   * @param {number} week - Week number
   * @param {number} cycle - Cycle number
   * @returns {Object|null} Status record or null if not set
   */
  static getLiftStatus(program_id, exercise_id, week, cycle) {
    return get(
      `SELECT * FROM program_lift_status 
       WHERE program_id = ? AND exercise_id = ? AND week = ? AND cycle = ?`,
      [program_id, exercise_id, week, cycle]
    );
  }
  
  /**
   * Get all statuses for a program's current week/cycle
   * @param {number} program_id - Program ID
   * @returns {Array} Array of status records with exercise info
   */
  static getCurrentWeekStatuses(program_id) {
    const program = this.findById(program_id);
    if (!program) {
      return [];
    }
    
    return all(
      `SELECT pls.*, e.name as exercise_name
       FROM program_lift_status pls
       JOIN exercises e ON pls.exercise_id = e.id
       WHERE pls.program_id = ? AND pls.week = ? AND pls.cycle = ?`,
      [program_id, program.current_week, program.current_cycle]
    );
  }
  
  /**
   * Get all statuses for a program (all weeks/cycles)
   * @param {number} program_id - Program ID
   * @returns {Array} Array of all status records
   */
  static getAllProgramStatuses(program_id) {
    return all(
      `SELECT pls.*, e.name as exercise_name
       FROM program_lift_status pls
       JOIN exercises e ON pls.exercise_id = e.id
       WHERE pls.program_id = ?
       ORDER BY pls.cycle, pls.week, e.name`,
      [program_id]
    );
  }
  
  /**
   * Clear status for a lift in a specific week/cycle
   * @param {number} program_id - Program ID
   * @param {number} exercise_id - Exercise ID
   * @param {number} week - Week number
   * @param {number} cycle - Cycle number
   * @returns {Object} Success indicator
   */
  static clearLiftStatus(program_id, exercise_id, week, cycle) {
    run(
      `DELETE FROM program_lift_status 
       WHERE program_id = ? AND exercise_id = ? AND week = ? AND cycle = ?`,
      [program_id, exercise_id, week, cycle]
    );
    return { success: true };
  }
  
  /**
   * Clear all statuses for current week/cycle
   * @param {number} program_id - Program ID
   * @returns {Object} Success indicator with count of cleared records
   */
  static clearCurrentWeekStatuses(program_id) {
    const program = this.findById(program_id);
    if (!program) {
      return { success: false, cleared: 0 };
    }
    
    run(
      `DELETE FROM program_lift_status 
       WHERE program_id = ? AND week = ? AND cycle = ?`,
      [program_id, program.current_week, program.current_cycle]
    );
    
    return { success: true };
  }
  
  // =====================================================
  // END: LIFT STATUS TRACKING METHODS
  // =====================================================
  
  /**
   * Advance to next session/week
   * Automatically adjusts training maxes/weights based on lift status:
   * - Failed lifts: Decrease by increment (deload)
   * - Completed/No status: Increase by increment (progress)
   * 
   * UPDATED: Now checks ALL weeks in the current cycle for failed lifts
   */
  static advanceWeek(id) {
    const program = this.findById(id);
    if (!program) {
      return null;
    }
    
    // UPDATED: Get ALL statuses for the current cycle (weeks 1-4)
    // instead of just the current week
    const allCycleStatuses = all(
      `SELECT pls.*, e.name as exercise_name
       FROM program_lift_status pls
       JOIN exercises e ON pls.exercise_id = e.id
       WHERE pls.program_id = ? AND pls.cycle = ?`,
      [id, program.current_cycle]
    );
    
    // Build a map of exercise_id -> array of statuses across all weeks
    const cycleStatusMap = new Map();
    allCycleStatuses.forEach(status => {
      if (!cycleStatusMap.has(status.exercise_id)) {
        cycleStatusMap.set(status.exercise_id, []);
      }
      cycleStatusMap.get(status.exercise_id).push({
        week: status.week,
        status: status.status,
        amrap_reps: status.amrap_reps
      });
    });
    
    let newWeek = program.current_week + 1;
    let newCycle = program.current_cycle;
    
    // For 5/3/1, cycle through weeks 1-3, then deload (week 4)
    // After week 4, advance to next cycle and adjust training maxes
    if (program.type === '531') {
      if (newWeek > 4) {
        newWeek = 1;
        newCycle += 1;
        
        // At the end of a cycle, adjust training maxes based on performance
        const lifts = all(
          'SELECT * FROM program_lifts WHERE program_id = ?',
          [id]
        );
        
        lifts.forEach(lift => {
          // Get exercise to determine weight increment
          const exercise = get('SELECT * FROM exercises WHERE id = ?', [lift.exercise_id]);
          
          if (exercise) {
            let increment = 5; // Default: upper body
            
            // Determine increment based on exercise
            const lowerBodyExercises = ['Barbell Squat', 'Barbell Deadlift', 'Power Clean'];
            if (lowerBodyExercises.includes(exercise.name)) {
              increment = 10;
            }
            
            // UPDATED: Check if this lift was marked as failed in ANY week of the cycle
            const liftStatuses = cycleStatusMap.get(lift.exercise_id) || [];
            const hasFailure = liftStatuses.some(s => s.status === 'failed');

            // Double the increment if any AMRAP set in the cycle achieved more than 10 reps
            const hasExtraAmrapReps = !hasFailure && liftStatuses.some(
              s => s.amrap_reps !== null && s.amrap_reps !== undefined && s.amrap_reps > 10
            );
            const effectiveIncrement = hasExtraAmrapReps ? increment * 2 : increment;

            let newTrainingMax;

            if (hasFailure) {
              // Deload: Decrease training max by the base increment amount
              newTrainingMax = lift.training_max - increment;
              const failedWeeks = liftStatuses
                .filter(s => s.status === 'failed')
                .map(s => s.week)
                .join(', ');
              console.log(`Deloading ${exercise.name}: ${lift.training_max} -> ${newTrainingMax} lbs (failed in week(s) ${failedWeeks})`);
            } else if (hasExtraAmrapReps) {
              // Double progression: Increase by 2x increment (>10 AMRAP reps achieved)
              newTrainingMax = lift.training_max + effectiveIncrement;
              const extraWeeks = liftStatuses
                .filter(s => s.amrap_reps !== null && s.amrap_reps !== undefined && s.amrap_reps > 10)
                .map(s => `week ${s.week} (${s.amrap_reps} reps)`)
                .join(', ');
              console.log(`Double progressing ${exercise.name}: ${lift.training_max} -> ${newTrainingMax} lbs (>10 AMRAP reps in ${extraWeeks})`);
            } else {
              // Progress normally: Increase training max by one increment
              newTrainingMax = lift.training_max + increment;
              console.log(`Progressing ${exercise.name}: ${lift.training_max} -> ${newTrainingMax} lbs`);
            }
            
            // Ensure training max doesn't go below a reasonable minimum (45 lbs - empty bar)
            if (newTrainingMax < 45) {
              newTrainingMax = 45;
            }
            
            this.updateLift(id, lift.exercise_id, newTrainingMax);
          }
        });
      }
    }
    
    // For Starting Strength, current_week is session count
    // current_cycle toggles between 1 (Workout A) and 2 (Workout B)
    if (program.type === 'starting_strength') {
      // Toggle between Workout A (cycle 1) and Workout B (cycle 2)
      newCycle = program.current_cycle === 1 ? 2 : 1;
      
      // Adjust weights for each lift based on status
      const lifts = all(
        'SELECT * FROM program_lifts WHERE program_id = ?',
        [id]
      );
      
      // Get current week statuses (for Starting Strength, we only check current session)
      const currentStatuses = this.getCurrentWeekStatuses(id);
      const statusMap = new Map();
      currentStatuses.forEach(status => {
        statusMap.set(status.exercise_id, status.status);
      });
      
      lifts.forEach(lift => {
        // Get exercise to determine weight increment
        const exercise = get('SELECT * FROM exercises WHERE id = ?', [lift.exercise_id]);
        
        if (exercise) {
          let increment = 5; // Default: upper body
          
          // Determine increment based on exercise
          const lowerBodyExercises = ['Barbell Squat', 'Barbell Deadlift', 'Power Clean'];
          if (lowerBodyExercises.includes(exercise.name)) {
            increment = 10;
          }
          
          // Check if this lift was marked as failed
          const liftStatus = statusMap.get(lift.exercise_id);
          let newWeight;
          
          if (liftStatus === 'failed') {
            // Deload: Decrease weight by the increment amount
            newWeight = lift.training_max - increment;
            console.log(`Deloading ${exercise.name}: ${lift.training_max} -> ${newWeight} lbs (failed)`);
          } else {
            // Progress normally: Increase weight
            newWeight = lift.training_max + increment;
            console.log(`Progressing ${exercise.name}: ${lift.training_max} -> ${newWeight} lbs`);
          }
          
          // Ensure weight doesn't go below a reasonable minimum (45 lbs - empty bar)
          if (newWeight < 45) {
            newWeight = 45;
          }
          
          // Update the weight (stored in training_max for Starting Strength)
          this.updateLift(id, lift.exercise_id, newWeight);
        }
      });
    }
    
    return this.update(id, {
      current_week: newWeek,
      current_cycle: newCycle
    });
  }
  
  /**
   * Calculate 5/3/1 sets for a given week and training max
   * @param {number} week - Week number (1-4)
   * @param {number} trainingMax - Training max for the exercise
   * @returns {Array} Array of set objects with weight, reps, and percentage
   */
  static calculate531Week(week, trainingMax) {
    const sets = [];
    
    // 5/3/1 percentages for each week
    const weekSchemes = {
      1: [
        { percentage: 0.65, reps: 5, isAmrap: false },
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.85, reps: 5, isAmrap: true }
      ],
      2: [
        { percentage: 0.70, reps: 3, isAmrap: false },
        { percentage: 0.80, reps: 3, isAmrap: false },
        { percentage: 0.90, reps: 3, isAmrap: true }
      ],
      3: [
        { percentage: 0.75, reps: 5, isAmrap: false },
        { percentage: 0.85, reps: 3, isAmrap: false },
        { percentage: 0.95, reps: 1, isAmrap: true }
      ],
      4: [ // Deload week
        { percentage: 0.40, reps: 5, isAmrap: false },
        { percentage: 0.50, reps: 5, isAmrap: false },
        { percentage: 0.60, reps: 5, isAmrap: false }
      ]
    };
    
    const scheme = weekSchemes[week] || weekSchemes[1];
    
    scheme.forEach((set, index) => {
      const weight = Math.round((trainingMax * set.percentage) / 2.5) * 2.5; // Round to nearest 2.5
      sets.push({
        set_number: index + 1,
        weight: weight,
        reps: set.reps,
        percentage: set.percentage * 100,
        is_amrap: set.isAmrap,
        is_warmup: false
      });
    });
    
    return sets;
  }
  
  /**
   * Generate Boring But Big (BBB) accessory sets
   * @param {number} trainingMax - Training max for the exercise
   * @param {number} bbbPercentage - BBB percentage (default 50%)
   * @returns {Array} Array of 5 sets at bbbPercentage
   */
  static generateBBBSets(trainingMax, bbbPercentage = 0.50) {
    const sets = [];
    const weight = Math.round((trainingMax * bbbPercentage) / 2.5) * 2.5; // Round to nearest 2.5
    
    // BBB is 5 sets of 10 reps
    for (let i = 0; i < 5; i++) {
      sets.push({
        set_number: i + 1,
        weight: weight,
        reps: 10,
        percentage: bbbPercentage * 100,
        is_amrap: false,
        is_warmup: false
      });
    }
    
    return sets;
  }
  
  /**
   * Generate Starting Strength workout sets
   * @param {string} exerciseName - Name of the exercise
   * @param {number} currentWeight - Current working weight
   * @returns {Array} Array of set objects
   */
  static generateStartingStrengthSets(exerciseName, currentWeight) {
    const sets = [];
    
    // Deadlift is 1 set of 5 reps
    if (exerciseName === 'Barbell Deadlift') {
      sets.push({
        set_number: 1,
        weight: currentWeight,
        reps: 5,
        is_warmup: false
      });
    }
    // Power Clean is 5 sets of 3 reps
    else if (exerciseName === 'Power Clean') {
      for (let i = 1; i <= 5; i++) {
        sets.push({
          set_number: i,
          weight: currentWeight,
          reps: 3,
          is_warmup: false
        });
      }
    }
    // All other lifts are 3 sets of 5 reps
    else {
      for (let i = 1; i <= 3; i++) {
        sets.push({
          set_number: i,
          weight: currentWeight,
          reps: 5,
          is_warmup: false
        });
      }
    }
    
    return sets;
  }
  
  /**
   * Get the current week's workout for a program
   * UPDATED: Now includes status for each lift AND warmup sets
   * @param {number} id - Program ID
   * @returns {Object} Complete workout with all lifts, their sets, warmup sets, and status
   */
  static getCurrentWeekWorkout(id) {
    const program = this.getWithLifts(id);
    if (!program) {
      return null;
    }
    
    // Get all statuses for current week/cycle
    const statuses = this.getCurrentWeekStatuses(id);
    const statusMap = new Map();
    statuses.forEach(status => {
      statusMap.set(status.exercise_id, {
        status: status.status,
        notes: status.notes,
        updated_at: status.updated_at,
        amrap_reps: status.amrap_reps
      });
    });
    
    const workout = {
      program_id: program.id,
      program_name: program.name,
      program_type: program.type,
      week: program.current_week,
      cycle: program.current_cycle,
      lifts: []
    };
    
    // For 5/3/1 BBB program
    if (program.type === '531') {
      program.lifts.forEach(lift => {
        const mainSets = this.calculate531Week(program.current_week, lift.training_max);
        const bbbSets = this.generateBBBSets(lift.training_max, 0.50);
        
        // Calculate warmup sets based on the heaviest main set
        const heaviestMainSetWeight = Math.max(...mainSets.map(set => set.weight));
        const warmupSets = this.getWarmupSets(heaviestMainSetWeight);
        
        // Add status to lift
        const liftStatus = statusMap.get(lift.exercise_id);
        
        workout.lifts.push({
          exercise_id: lift.exercise_id,
          exercise_name: lift.exercise_name,
          training_max: lift.training_max,
          warmup_sets: warmupSets,
          main_sets: mainSets,
          accessory_sets: bbbSets,
          status: liftStatus ? liftStatus.status : null,
          status_notes: liftStatus ? liftStatus.notes : null,
          status_updated_at: liftStatus ? liftStatus.updated_at : null,
          amrap_reps: liftStatus ? liftStatus.amrap_reps : null
        });
      });
    }
    
    // For Starting Strength program
    if (program.type === 'starting_strength') {
      // Determine which workout (A or B)
      const isWorkoutA = program.current_cycle === 1;
      
      // Workout A: Squat, Bench, Deadlift
      // Workout B: Squat, OHP, Deadlift (or Power Clean)
      const workoutExercises = isWorkoutA
        ? ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift']
        : ['Barbell Squat', 'Barbell Overhead Press', 'Barbell Deadlift'];
      
      // Filter lifts to only include those in current workout
      const workoutLifts = program.lifts.filter(lift => 
        workoutExercises.includes(lift.exercise_name)
      );
      
      workoutLifts.forEach(lift => {
        // For Starting Strength, training_max is actually current working weight
        const sets = this.generateStartingStrengthSets(lift.exercise_name, lift.training_max);
        
        // Calculate warmup sets based on working weight
        const warmupSets = this.getWarmupSets(lift.training_max);
        
        // Add status to lift
        const liftStatus = statusMap.get(lift.exercise_id);
        
        workout.lifts.push({
          exercise_id: lift.exercise_id,
          exercise_name: lift.exercise_name,
          current_weight: lift.training_max, // Using training_max field to store current weight
          warmup_sets: warmupSets,
          sets: sets,
          status: liftStatus ? liftStatus.status : null,
          status_notes: liftStatus ? liftStatus.notes : null,
          status_updated_at: liftStatus ? liftStatus.updated_at : null
        });
      });
      
      // Add workout type label
      workout.workout_type = isWorkoutA ? 'Workout A' : 'Workout B';
      workout.session_number = program.current_week;
    }
    
    return workout;
  }
  
  /**
   * Get recommended warmup sets for a given working weight
   * @param {number} workingWeight - The main working weight
   * @returns {Array} Array of warmup set objects
   */
  static getWarmupSets(workingWeight) {
    const warmups = [];
    /*
    // Bar only
    warmups.push({
      weight: 45, // Standard barbell weight (lbs) - should be configurable
      reps: 5,
      is_warmup: true
    });
    */
    // 40% of working weight
    const weight40 = Math.round((workingWeight * 0.40) / 5) * 5;
    if(weight40 < 45) {
        warmups.push({
        weight: 45, // Standard barbell weight (lbs) - should be configurable
        reps: 5,
        is_warmup: true
      });
    } else {
      warmups.push({
        weight: weight40,
        reps: 5,
        is_warmup: true
      });
    }

    // 50% of working weight
    const weight50 = Math.round((workingWeight * 0.50) / 5) * 5;
    if(weight50 < 45) {
        warmups.push({
        weight: 45, // Standard barbell weight (lbs) - should be configurable
        reps: 5,
        is_warmup: true
      });
    } else {
      warmups.push({
        weight: weight50,
        reps: 5,
        is_warmup: true
      });
    }
    
    // 60% of working weight
    const weight60 = workingWeight * 0.60;
    if(weight60 < 45) {
        warmups.push({
        weight: 45, // Standard barbell weight (lbs) - should be configurable
        reps: 3,
        is_warmup: true
      });
    } else {
      warmups.push({
        weight: weight60,
        reps: 3,
        is_warmup: true
      });
    }
    
    return warmups;
  }
}

export default Program;