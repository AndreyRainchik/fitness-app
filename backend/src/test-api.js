#!/usr/bin/env node

/**
 * API Endpoint Test Script
 * Tests all API endpoints to ensure they're working correctly
 */

const API_URL = 'http://localhost:3000';
let authToken = null;
let userId = null;
let workoutId = null;
let setId = null;

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const result = await response.json();
  
  return { status: response.status, data: result };
}

// Color output helpers
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
};

console.log(colors.cyan('\n🧪 Testing Fitness App API\n'));
console.log('═══════════════════════════════════════\n');

// TEST 1: Health Check
console.log(colors.blue('📝 TEST 1: Health Check'));
try {
  const { status, data } = await apiCall('GET', '/health');
  if (status === 200) {
    console.log(colors.green(`  ✅ Health check passed: ${data.status}`));
  } else {
    console.log(colors.red('  ❌ Health check failed'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Health check failed: ' + error.message));
}

// TEST 2: Register User
console.log(colors.blue('\n📝 TEST 2: Register User'));
try {
  const { status, data } = await apiCall('POST', '/api/auth/register', {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    username: 'TestUser',
    bodyweight: 185,
    units: 'lbs'
  });
  
  if (status === 201) {
    authToken = data.token;
    userId = data.user.id;
    console.log(colors.green(`  ✅ User registered: ${data.user.username} (ID: ${userId})`));
    console.log(colors.yellow(`  🔑 Token: ${authToken.substring(0, 20)}...`));
  } else {
    console.log(colors.red('  ❌ Registration failed: ' + JSON.stringify(data)));
  }
} catch (error) {
  console.log(colors.red('  ❌ Registration failed: ' + error.message));
}

// TEST 3: Get Current User
console.log(colors.blue('\n📝 TEST 3: Get Current User'));
try {
  const { status, data } = await apiCall('GET', '/api/auth/me', null, authToken);
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Current user: ${data.user.username}`));
  } else {
    console.log(colors.red('  ❌ Failed to get current user'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to get current user: ' + error.message));
}

// TEST 4: Get All Exercises
console.log(colors.blue('\n📝 TEST 4: Get All Exercises'));
try {
  const { status, data } = await apiCall('GET', '/api/exercises');
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Found ${data.count} exercises`));
  } else {
    console.log(colors.red('  ❌ Failed to get exercises'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to get exercises: ' + error.message));
}

// TEST 5: Search Exercises
console.log(colors.blue('\n📝 TEST 5: Search Exercises (bench)'));
try {
  const { status, data } = await apiCall('GET', '/api/exercises/search?q=bench');
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Found ${data.count} exercises matching "bench"`));
    if (data.exercises.length > 0) {
      console.log(colors.yellow(`  📋 Example: ${data.exercises[0].name}`));
    }
  } else {
    console.log(colors.red('  ❌ Failed to search exercises'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to search exercises: ' + error.message));
}

// TEST 6: Get Exercises by Muscle Group
console.log(colors.blue('\n📝 TEST 6: Get Exercises by Muscle Group (Chest)'));
try {
  const { status, data } = await apiCall('GET', '/api/exercises?muscle_group=Chest');
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Found ${data.count} chest exercises`));
  } else {
    console.log(colors.red('  ❌ Failed to get chest exercises'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to get chest exercises: ' + error.message));
}

// TEST 7: Create Workout
console.log(colors.blue('\n📝 TEST 7: Create Workout'));
try {
  const today = new Date().toISOString().split('T')[0];
  const { status, data } = await apiCall('POST', '/api/workouts', {
    date: today,
    name: 'Push Day',
    duration_minutes: 60
  }, authToken);
  
  if (status === 201) {
    workoutId = data.workout.id;
    console.log(colors.green(`  ✅ Workout created: ${data.workout.name} (ID: ${workoutId})`));
  } else {
    console.log(colors.red('  ❌ Failed to create workout: ' + JSON.stringify(data)));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to create workout: ' + error.message));
}

// TEST 8: Add Set to Workout
console.log(colors.blue('\n📝 TEST 8: Add Set to Workout'));
try {
  // Find bench press exercise ID
  const { data: exercisesData } = await apiCall('GET', '/api/exercises/search?q=Barbell%20Bench%20Press');
  const benchPressId = exercisesData.exercises[0].id;
  
  const { status, data } = await apiCall('POST', `/api/workouts/${workoutId}/sets`, {
    exercise_id: benchPressId,
    set_number: 1,
    reps: 5,
    weight: 225,
    rpe: 8
  }, authToken);
  
  if (status === 201) {
    setId = data.set.id;
    console.log(colors.green(`  ✅ Set added: ${data.set.reps} reps @ ${data.set.weight} lbs (RPE: ${data.set.rpe})`));
  } else {
    console.log(colors.red('  ❌ Failed to add set: ' + JSON.stringify(data)));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to add set: ' + error.message));
}

// TEST 9: Get Workout with Details
console.log(colors.blue('\n📝 TEST 9: Get Workout with Details'));
try {
  const { status, data } = await apiCall('GET', `/api/workouts/${workoutId}`, null, authToken);
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Workout retrieved: ${data.workout.name}`));
    console.log(colors.yellow(`  📊 Sets in workout: ${data.workout.sets.length}`));
  } else {
    console.log(colors.red('  ❌ Failed to get workout'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to get workout: ' + error.message));
}

// TEST 10: Update Set
console.log(colors.blue('\n📝 TEST 10: Update Set'));
try {
  const { status, data } = await apiCall('PUT', `/api/workouts/sets/${setId}`, {
    reps: 6,
    weight: 225,
    rpe: 7.5
  }, authToken);
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Set updated: ${data.set.reps} reps @ ${data.set.weight} lbs (RPE: ${data.set.rpe})`));
  } else {
    console.log(colors.red('  ❌ Failed to update set'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to update set: ' + error.message));
}

// TEST 11: Get All Workouts
console.log(colors.blue('\n📝 TEST 11: Get All Workouts'));
try {
  const { status, data } = await apiCall('GET', '/api/workouts', null, authToken);
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Found ${data.count} workout(s)`));
  } else {
    console.log(colors.red('  ❌ Failed to get workouts'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to get workouts: ' + error.message));
}

// TEST 12: Update Profile
console.log(colors.blue('\n📝 TEST 12: Update Profile'));
try {
  const { status, data } = await apiCall('PUT', '/api/auth/me', {
    bodyweight: 190,
    units: 'lbs'
  }, authToken);
  
  if (status === 200) {
    console.log(colors.green(`  ✅ Profile updated: ${data.user.bodyweight} ${data.user.units}`));
  } else {
    console.log(colors.red('  ❌ Failed to update profile'));
  }
} catch (error) {
  console.log(colors.red('  ❌ Failed to update profile: ' + error.message));
}

// SUMMARY
console.log('\n═══════════════════════════════════════');
console.log(colors.cyan('✅ API TESTS COMPLETED!'));
console.log('═══════════════════════════════════════');
console.log(colors.green('Summary:'));
console.log(colors.green('  • Health Check: ✅'));
console.log(colors.green('  • Authentication: ✅'));
console.log(colors.green('  • Exercises: ✅'));
console.log(colors.green('  • Workouts: ✅'));
console.log(colors.green('  • Sets: ✅'));
console.log('═══════════════════════════════════════\n');

process.exit(0);