#!/usr/bin/env node

/**
 * Analytics API Test Script
 * 
 * Tests all 4 analytics endpoints with a test user
 * 
 * Usage:
 *   node test-analytics.js <email> <password>
 * 
 * Example:
 *   node test-analytics.js test@example.com password123
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Helper functions
function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

// Main test function
async function runTests() {
  log('cyan', '\n🧪 ANALYTICS API TEST SUITE');
  log('cyan', '═══════════════════════════════════════\n');

  const args = process.argv.slice(2);
  if (args.length < 2) {
    log('red', '❌ Usage: node test-analytics.js <email> <password>');
    log('yellow', 'Example: node test-analytics.js test@example.com password123\n');
    process.exit(1);
  }

  const [email, password] = args;
  let authToken = null;

  // TEST 1: Login
  log('blue', '📝 TEST 1: Login');
  try {
    const { status, data } = await apiCall('/auth/login', 'POST', { email, password });
    
    if (status === 200) {
      authToken = data.token;
      log('green', `  ✅ Login successful`);
      log('yellow', `  👤 User: ${data.user.username}`);
    } else {
      log('red', `  ❌ Login failed: ${JSON.stringify(data)}`);
      process.exit(1);
    }
  } catch (error) {
    log('red', `  ❌ Login error: ${error.message}`);
    process.exit(1);
  }

  // TEST 2: Lift Progression
  log('blue', '\n📊 TEST 2: Lift Progression (Squat, 12 weeks)');
  try {
    const { status, data } = await apiCall(
      '/analytics/lift-progression/Barbell%20Squat?weeks=12',
      'GET',
      null,
      authToken
    );
    
    if (status === 200) {
      log('green', `  ✅ Lift progression retrieved`);
      log('yellow', `  📈 Data points: ${data.dataPoints}`);
      if (data.progression && data.progression.length > 0) {
        const latest = data.progression[data.progression.length - 1];
        log('yellow', `  💪 Latest: ${latest.weight}lbs x ${latest.reps} reps = ${latest.estimated1RM} 1RM`);
        log('yellow', `  🏆 Standard: ${latest.standard} (${latest.percentile}th percentile)`);
        log('yellow', `  📊 Wilks: ${latest.wilksScore}`);
      } else {
        log('yellow', '  ℹ️  No squat data found');
      }
    } else {
      log('red', `  ❌ Failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    log('red', `  ❌ Error: ${error.message}`);
  }

  // TEST 3: Strength Score
  log('blue', '\n🏋️  TEST 3: Strength Score (All main lifts)');
  try {
    const { status, data } = await apiCall(
      '/analytics/strength-score?weeks=12',
      'GET',
      null,
      authToken
    );
    
    if (status === 200) {
      log('green', `  ✅ Strength score retrieved`);
      log('yellow', `  ⚖️  Bodyweight: ${data.bodyweight.value} ${data.bodyweight.units}`);
      log('yellow', `  📦 Total: ${data.total} lbs\n`);
      
      // Display each lift
      ['squat', 'bench', 'deadlift', 'ohp'].forEach(lift => {
        if (data[lift] && data[lift].estimated1RM > 0) {
          log('cyan', `  ${lift.toUpperCase()}:`);
          log('yellow', `    • 1RM: ${data[lift].estimated1RM} lbs`);
          log('yellow', `    • Level: ${data[lift].standard} (${data[lift].percentile}th percentile)`);
          if (data[lift].nextLevel) {
            log('yellow', `    • Next: ${data[lift].nextLevel.level} @ ${data[lift].nextLevel.weight} lbs`);
          }
          if (data[lift].recentPR) {
            log('yellow', `    • Recent PR: ${data[lift].recentPR.weight}x${data[lift].recentPR.reps} on ${data[lift].recentPR.date}`);
          }
        } else {
          log('yellow', `  ${lift.toUpperCase()}: No data`);
        }
      });
    } else {
      log('red', `  ❌ Failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    log('red', `  ❌ Error: ${error.message}`);
  }

  // TEST 4: Symmetry Analysis
  log('blue', '\n⚖️  TEST 4: Symmetry Analysis');
  try {
    const { status, data } = await apiCall(
      '/analytics/symmetry',
      'GET',
      null,
      authToken
    );
    
    if (status === 200) {
      log('green', `  ✅ Symmetry analysis complete`);
      log('yellow', `  📊 Overall Score: ${data.overallScore}/100 - ${data.interpretation}\n`);
      
      // Display ratios
      log('cyan', '  Ratios:');
      log('yellow', `    • Squat/Deadlift: ${data.ratios.squatToDeadlift} (ideal: 0.85)`);
      log('yellow', `    • Bench/Squat: ${data.ratios.benchToSquat} (ideal: 0.70)`);
      log('yellow', `    • OHP/Bench: ${data.ratios.ohpToBench} (ideal: 0.625)`);
      log('yellow', `    • Deadlift/Squat: ${data.ratios.deadliftToSquat} (ideal: 1.20)`);
      
      // Display imbalances
      if (data.imbalances && data.imbalances.length > 0) {
        log('yellow', '\n  ⚠️  Detected Imbalances:');
        data.imbalances.forEach((imb, i) => {
          log('red', `    ${i + 1}. ${imb.lift} - ${imb.message}`);
          log('cyan', `       💡 ${imb.suggestion}`);
        });
      } else {
        log('green', '\n  ✅ No significant imbalances detected!');
      }
    } else {
      log('red', `  ❌ Failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    log('red', `  ❌ Error: ${error.message}`);
  }

  // TEST 5: Dashboard Summary
  log('blue', '\n📊 TEST 5: Dashboard Summary');
  try {
    const { status, data } = await apiCall(
      '/analytics/dashboard-summary',
      'GET',
      null,
      authToken
    );
    
    if (status === 200) {
      log('green', `  ✅ Dashboard summary retrieved\n`);
      
      log('cyan', '  📈 Workout Stats:');
      log('yellow', `    • Total Workouts: ${data.totalWorkouts}`);
      log('yellow', `    • This Week: ${data.thisWeek}`);
      log('yellow', `    • Current Streak: ${data.streak} days`);
      log('yellow', `    • Avg per Week: ${data.summary.averageWorkoutsPerWeek}`);
      log('yellow', `    • Last Workout: ${data.summary.lastWorkoutDate || 'N/A'}`);
      
      if (data.recentPRs && data.recentPRs.length > 0) {
        log('cyan', '\n  🏆 Recent PRs:');
        data.recentPRs.forEach((pr, i) => {
          log('green', `    ${i + 1}. ${pr.exercise}: ${pr.weight}x${pr.reps} = ${pr.estimated1RM} 1RM (${pr.date})`);
        });
      } else {
        log('yellow', '\n  ℹ️  No recent PRs in last 30 days');
      }
    } else {
      log('red', `  ❌ Failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    log('red', `  ❌ Error: ${error.message}`);
  }

  // Summary
  log('cyan', '\n═══════════════════════════════════════');
  log('green', '✅ ALL ANALYTICS TESTS COMPLETED!');
  log('cyan', '═══════════════════════════════════════\n');
}

// Run the tests
runTests().catch(error => {
  log('red', `\n💥 Fatal error: ${error.message}\n`);
  process.exit(1);
});