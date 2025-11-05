# Models Documentation

This directory contains all database models for the Fitness App backend. Each model provides a clean interface for interacting with its respective database table.

## Available Models

### 1. User Model (`User.js`)

Manages user authentication and profiles.

**Methods:**
- `create({ email, password, username, bodyweight, units })` - Create new user
- `findByEmail(email)` - Find user by email
- `findById(id)` - Find user by ID
- `verifyPassword(email, password)` - Authenticate user
- `update(id, { username, bodyweight, units })` - Update user profile
- `delete(id)` - Delete user
- `getAll()` - Get all users (admin)

**Example:**
```javascript
const user = await User.create({
  email: 'john@example.com',
  password: 'securepass123',
  username: 'JohnDoe',
  bodyweight: 180,
  units: 'lbs'
});
```

---

### 2. Exercise Model (`Exercise.js`)

Manages the exercise library.

**Methods:**
- `getAll()` - Get all exercises
- `findById(id)` - Get exercise by ID
- `getByCategory(category)` - Filter by category
- `getByMuscleGroup(muscleGroup)` - Filter by muscle group
- `getCompoundExercises()` - Get all compound exercises
- `getMuscleGroups()` - Get list of muscle groups
- `search(query)` - Search exercises by name
- `create({ name, category, primary_muscle_group, ... })` - Add custom exercise
- `update(id, { ... })` - Update exercise
- `delete(id)` - Delete exercise

**Example:**
```javascript
const chestExercises = Exercise.getByMuscleGroup('Chest');
const benchPress = Exercise.search('Barbell Bench Press')[0];
```

---

### 3. Workout Model (`Workout.js`)

Manages workout sessions.

**Methods:**
- `create({ user_id, date, name, notes, duration_minutes })` - Create workout
- `findById(id)` - Get workout by ID
- `getByUser(user_id, limit)` - Get user's workouts
- `getByUserAndDateRange(user_id, start_date, end_date)` - Filter by date
- `getWithDetails(id)` - Get workout with all sets and exercises
- `update(id, { ... })` - Update workout
- `delete(id)` - Delete workout
- `getCountByUser(user_id)` - Count user's workouts
- `getLastWorkoutDate(user_id)` - Get last workout date

**Example:**
```javascript
const workout = Workout.create({
  user_id: 1,
  date: '2025-11-05',
  name: 'Leg Day',
  duration_minutes: 75
});
```

---

### 4. Set Model (`Set.js`)

Manages individual exercise sets.

**Methods:**
- `create({ workout_id, exercise_id, set_number, reps, weight, rpe, ... })` - Log set
- `findById(id)` - Get set by ID
- `getByWorkout(workout_id)` - Get all sets in a workout
- `getByExercise(exercise_id, user_id, limit)` - Get sets for an exercise
- `getPersonalRecords(exercise_id, user_id)` - Get PRs
- `update(id, { ... })` - Update set
- `delete(id)` - Delete set
- `getTotalVolume(exercise_id, user_id, start_date, end_date)` - Calculate volume

**Example:**
```javascript
const set = Set.create({
  workout_id: 1,
  exercise_id: 2,
  set_number: 1,
  reps: 5,
  weight: 225,
  rpe: 8
});

const prs = Set.getPersonalRecords(2, 1); // exercise_id, user_id
console.log(`Max weight: ${prs.max_weight.max_weight}`);
```

---

### 5. Program Model (`Program.js`)

Manages training programs (5/3/1, custom programs).

**Methods:**
- `create({ user_id, name, type, start_date, ... })` - Create program
- `findById(id)` - Get program by ID
- `getActiveByUser(user_id)` - Get user's active program
- `getByUser(user_id)` - Get all user's programs
- `getWithLifts(id)` - Get program with all lifts
- `update(id, { ... })` - Update program
- `delete(id)` - Delete program
- `addLift(program_id, exercise_id, training_max)` - Add lift to program
- `updateLift(program_id, exercise_id, training_max)` - Update training max
- `getLift(program_id, exercise_id)` - Get lift details
- `removeLift(program_id, exercise_id)` - Remove lift
- `advanceWeek(id)` - Progress to next week

**Example:**
```javascript
const program = Program.create({
  user_id: 1,
  name: '5/3/1 BBB',
  type: '531',
  start_date: '2025-11-01'
});

Program.addLift(program.id, 1, 315); // Squat with 315 TM
Program.advanceWeek(program.id); // Move to week 2
```

---

## Usage

Import models:
```javascript
import { User, Exercise, Workout, Set, Program } from './models/index.js';
```

All models automatically save to the database after operations.

## Testing

Run the comprehensive model test:
```bash
node src/test-models.js
```

This will test all CRUD operations for each model.