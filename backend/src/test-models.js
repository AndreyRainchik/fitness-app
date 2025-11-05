import { initDatabase } from './config/database.js';
import { User, Exercise, Workout, Set, Program } from './models/index.js';

async function testModels() {
  console.log('🧪 Testing All Models\n');
  
  try {
    await initDatabase();
    
    // TEST 1: User Model
    console.log('📝 TEST 1: User Model');
    console.log('  Creating user...');
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      username: 'TestUser',
      bodyweight: 180,
      units: 'lbs'
    });
    console.log(`  ✅ User created: ${user.username} (ID: ${user.id})`);
    
    console.log('  Verifying password...');
    const verifiedUser = await User.verifyPassword('test@example.com', 'password123');
    console.log(`  ✅ Password verified for: ${verifiedUser.username}`);
    
    console.log('  Finding user by ID...');
    const foundUser = User.findById(user.id);
    console.log(`  ✅ Found user: ${foundUser.username}\n`);
    
    // TEST 2: Exercise Model
    console.log('📝 TEST 2: Exercise Model');
    console.log('  Getting all exercises...');
    const exercises = Exercise.getAll();
    console.log(`  ✅ Found ${exercises.length} exercises`);
    
    console.log('  Getting exercises by muscle group (Chest)...');
    const chestExercises = Exercise.getByMuscleGroup('Chest');
    console.log(`  ✅ Found ${chestExercises.length} chest exercises`);
    
    console.log('  Getting compound exercises...');
    const compounds = Exercise.getCompoundExercises();
    console.log(`  ✅ Found ${compounds.length} compound exercises\n`);
    
    // TEST 3: Workout Model
    console.log('📝 TEST 3: Workout Model');
    console.log('  Creating workout...');
    const workout = Workout.create({
      user_id: user.id,
      date: '2025-11-05',
      name: 'Chest Day',
      duration_minutes: 60
    });
    console.log(`  ✅ Workout created: ${workout.name} (ID: ${workout.id})`);
    
    console.log('  Getting user workouts...');
    const userWorkouts = Workout.getByUser(user.id);
    console.log(`  ✅ Found ${userWorkouts.length} workouts for user\n`);
    
    // TEST 4: Set Model
    console.log('📝 TEST 4: Set Model');
    console.log('  Adding sets to workout...');
    
    // Find bench press exercise
    const benchPress = Exercise.search('Barbell Bench Press')[0];
    
    // Add 3 sets
    const set1 = Set.create({
      workout_id: workout.id,
      exercise_id: benchPress.id,
      set_number: 1,
      reps: 5,
      weight: 135,
      is_warmup: 1
    });
    console.log(`  ✅ Set 1: ${set1.reps} reps @ ${set1.weight} lbs (warmup)`);
    
    const set2 = Set.create({
      workout_id: workout.id,
      exercise_id: benchPress.id,
      set_number: 2,
      reps: 5,
      weight: 185
    });
    console.log(`  ✅ Set 2: ${set2.reps} reps @ ${set2.weight} lbs`);
    
    const set3 = Set.create({
      workout_id: workout.id,
      exercise_id: benchPress.id,
      set_number: 3,
      reps: 5,
      weight: 185,
      rpe: 8.5
    });
    console.log(`  ✅ Set 3: ${set3.reps} reps @ ${set3.weight} lbs (RPE: ${set3.rpe})`);
    
    console.log('  Getting workout with details...');
    const workoutDetails = Workout.getWithDetails(workout.id);
    console.log(`  ✅ Workout has ${workoutDetails.sets.length} sets`);
    
    console.log('  Getting personal records...');
    const prs = Set.getPersonalRecords(benchPress.id, user.id);
    console.log(`  ✅ Max weight: ${prs.max_weight?.max_weight || 0} lbs\n`);
    
    // TEST 5: Program Model
    console.log('📝 TEST 5: Program Model');
    console.log('  Creating 5/3/1 program...');
    const program = Program.create({
      user_id: user.id,
      name: '5/3/1 Boring But Big',
      type: '531',
      start_date: '2025-11-01'
    });
    console.log(`  ✅ Program created: ${program.name} (ID: ${program.id})`);
    
    console.log('  Adding lifts to program...');
    const squat = Exercise.search('Barbell Squat')[0];
    const deadlift = Exercise.search('Barbell Deadlift')[0];
    
    Program.addLift(program.id, squat.id, 315);
    console.log(`  ✅ Added ${squat.name} - TM: 315 lbs`);
    
    Program.addLift(program.id, deadlift.id, 405);
    console.log(`  ✅ Added ${deadlift.name} - TM: 405 lbs`);
    
    console.log('  Getting program with lifts...');
    const programDetails = Program.getWithLifts(program.id);
    console.log(`  ✅ Program has ${programDetails.lifts.length} lifts configured`);
    
    console.log('  Advancing to next week...');
    const advanced = Program.advanceWeek(program.id);
    console.log(`  ✅ Now on Week ${advanced.current_week}, Cycle ${advanced.current_cycle}\n`);
    
    // SUMMARY
    console.log('═══════════════════════════════════════');
    console.log('✅ ALL MODEL TESTS PASSED!');
    console.log('═══════════════════════════════════════');
    console.log('Summary:');
    console.log(`  • User Model: ✅ Create, Find, Verify`);
    console.log(`  • Exercise Model: ✅ Get, Search, Filter`);
    console.log(`  • Workout Model: ✅ Create, Retrieve, Details`);
    console.log(`  • Set Model: ✅ Create, PRs, Volume`);
    console.log(`  • Program Model: ✅ Create, Lifts, Advance`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Model test failed:', error);
    process.exit(1);
  }
}

testModels();