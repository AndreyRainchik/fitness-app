# Workout Logging Features

## Overview

The workout logging system allows users to track their training sessions, including exercises, sets, reps, weight, and RPE (Rate of Perceived Exertion).

## Pages

### 1. New Workout (`/workout/new`)

**Purpose**: Log a new workout session

**Features**:
- ✅ Enter workout name
- ✅ Select workout date
- ✅ Add multiple exercises
- ✅ Add multiple sets per exercise
- ✅ Track weight, reps, and RPE for each set
- ✅ Save workout to database
- ✅ Form validation
- ✅ Loading states
- ✅ Error handling

**User Flow**:
```
1. User navigates to /workout/new
2. Enters workout details (name, date)
3. Clicks "Add Exercise"
4. Enters exercise name
5. Clicks "Add Set"
6. Fills in weight, reps, RPE
7. Repeats for more sets/exercises
8. Clicks "Save Workout"
9. Redirected to /workouts
```

### 2. Workout History (`/workouts`)

**Purpose**: View all past workouts

**Features**:
- ✅ List all workouts chronologically
- ✅ Display workout date and name
- ✅ Show exercise summary
- ✅ Display total volume
- ✅ Delete workout functionality
- ✅ Link to detailed view
- ✅ "New Workout" button
- ✅ Empty state message
- ✅ Loading states

**Display Info**:
- Workout name
- Date (formatted)
- Duration (if logged)
- Exercise list preview (first 5)
- Total volume (weight × reps)

### 3. Workout Detail (`/workout/:id`)

**Purpose**: View detailed breakdown of a specific workout

**Features**:
- ✅ Full workout details
- ✅ Summary statistics (volume, exercises, sets)
- ✅ Exercise-by-exercise breakdown
- ✅ Set-by-set details table
- ✅ Calculated subtotals per exercise
- ✅ Delete workout option
- ✅ Back to workouts link
- ✅ Loading and error states

**Summary Stats**:
- Total Volume (sum of all weight × reps)
- Number of Exercises
- Total Sets

**Exercise Breakdown**:
- Exercise name as section header
- Table of all sets:
  - Set number
  - Weight
  - Reps
  - RPE
  - Volume (weight × reps)
- Subtotal per exercise

## Data Structure

### Workout Object
```javascript
{
  id: 1,
  userId: 1,
  name: "Upper Body Day",
  date: "2025-11-06",
  duration: 60, // minutes (optional)
  sets: [
    {
      id: 1,
      workoutId: 1,
      exerciseName: "Bench Press",
      setNumber: 1,
      weight: 185,
      reps: 8,
      rpe: 8
    },
    // ... more sets
  ]
}
```

### Form State (NewWorkout)
```javascript
{
  workoutName: "Upper Body Day",
  workoutDate: "2025-11-06",
  exercises: [
    {
      id: Date.now(), // temporary ID
      exerciseName: "Bench Press",
      sets: [
        {
          id: Date.now(),
          setNumber: 1,
          weight: "185",
          reps: "8",
          rpe: "8"
        }
      ]
    }
  ]
}
```

## API Integration

### Create Workout
```javascript
// 1. Create workout
const workout = await workoutsAPI.create({
  name: "Upper Body Day",
  date: "2025-11-06",
  duration: 0
});

// 2. Add sets for each exercise
for (const exercise of exercises) {
  for (const set of exercise.sets) {
    await workoutsAPI.addSet(workout.id, {
      exerciseName: exercise.exerciseName,
      setNumber: set.setNumber,
      weight: parseFloat(set.weight),
      reps: parseInt(set.reps),
      rpe: set.rpe ? parseInt(set.rpe) : null
    });
  }
}
```

### Fetch Workouts
```javascript
// Get all workouts for current user
const data = await workoutsAPI.getAll();
// Returns: { workouts: [...] }

// Get specific workout
const workout = await workoutsAPI.getById(id);
// Returns: { id, name, date, sets: [...] }
```

### Delete Workout
```javascript
await workoutsAPI.delete(workoutId);
```

## Validation Rules

### Workout Details
- **Name**: Required, non-empty string
- **Date**: Valid date, defaults to today

### Exercise
- **Name**: Required, non-empty string
- **Sets**: At least 1 set required

### Set
- **Weight**: Number ≥ 0, allows decimals (0.5 increments)
- **Reps**: Integer ≥ 0
- **RPE**: Optional, integer 1-10 if provided

## User Experience Features

### Dynamic Form
- Add/remove exercises dynamically
- Add/remove sets dynamically
- Auto-numbering of sets
- Responsive grid layout

### Visual Feedback
- Loading spinners during API calls
- Disabled buttons while saving
- Error messages for validation
- Success navigation after save
- Confirmation dialogs for delete

### Smart Defaults
- Date defaults to today
- Units from user profile (lbs/kg)
- Set numbers auto-increment
- Form clears after successful save

## Calculations

### Volume Calculation
```javascript
volume = weight × reps

// Total volume for exercise
exerciseVolume = sum(set.weight × set.reps for all sets)

// Total volume for workout
workoutVolume = sum(exerciseVolume for all exercises)
```

### Example
```
Bench Press:
  Set 1: 185 lbs × 8 reps = 1,480
  Set 2: 185 lbs × 8 reps = 1,480
  Set 3: 185 lbs × 8 reps = 1,480
  Subtotal: 4,440 lbs

Squat:
  Set 1: 225 lbs × 5 reps = 1,125
  Set 2: 225 lbs × 5 reps = 1,125
  Set 3: 225 lbs × 5 reps = 1,125
  Subtotal: 3,375 lbs

Total Workout Volume: 7,815 lbs
```

## Future Enhancements

Planned features:
- [ ] Exercise search/autocomplete
- [ ] Exercise history (PR tracking)
- [ ] Rest timer between sets
- [ ] Workout duration tracking
- [ ] Template workouts
- [ ] Copy previous workout
- [ ] Edit existing workout
- [ ] Exercise notes/comments
- [ ] Superset grouping
- [ ] Failure indicators
- [ ] Form check indicators

## Mobile Optimization

The workout logging interface is fully responsive:

**Desktop**:
- Wide form layouts
- Multi-column grids
- Table views for sets

**Mobile**:
- Stacked layouts
- Scrollable tables
- Touch-friendly inputs
- Larger tap targets

## Testing Guide

### Test New Workout

1. Navigate to /workout/new
2. Enter workout name: "Test Workout"
3. Leave date as today
4. Click "Add Exercise"
5. Enter exercise: "Bench Press"
6. Click "Add Set"
7. Enter: 185 weight, 8 reps, 8 RPE
8. Click "Add Set" again
9. Enter: 185 weight, 8 reps, 8 RPE
10. Click "Add Exercise"
11. Enter exercise: "Squat"
12. Add 3 sets with different values
13. Click "Save Workout"
14. ✅ Should redirect to /workouts
15. ✅ Should see new workout in list

### Test Workout History

1. Navigate to /workouts
2. ✅ Should see list of workouts
3. ✅ Should see workout names and dates
4. ✅ Should see exercise previews
5. Click "View" on a workout
6. ✅ Should navigate to detail page

### Test Workout Detail

1. From /workouts, click "View" on any workout
2. ✅ Should see full workout breakdown
3. ✅ Should see summary stats
4. ✅ Should see all exercises
5. ✅ Should see all sets in tables
6. ✅ Should see volume calculations
7. Click "Delete Workout"
8. Confirm deletion
9. ✅ Should redirect to /workouts
10. ✅ Workout should be removed

### Test Validation

1. On /workout/new, try to save without name
2. ✅ Should show error message
3. Add name, try to save without exercises
4. ✅ Should show error message
5. Add exercise without name
6. ✅ Should show error message
7. Add exercise with name but no sets
8. ✅ Should show error message

## Components Used

- `Layout` - Consistent page wrapper
- `useAuth` - Access user units
- `workoutsAPI` - API calls
- `useNavigate` - Programmatic navigation
- `useState` - Form state management
- `useEffect` - Data fetching
- `useParams` - Get workout ID from URL

## Error Handling

All pages handle errors gracefully:
- Network errors
- API errors (4xx, 5xx)
- Invalid data
- Missing workouts
- Authentication errors

Error messages are user-friendly and actionable.

## Performance Considerations

- API calls only when needed
- Loading states prevent multiple submissions
- Optimistic UI updates for better UX
- Minimal re-renders with proper state management

## Summary

✅ **Full workout logging capability**
✅ **Create workouts with multiple exercises and sets**
✅ **View workout history**
✅ **Detailed workout breakdowns**
✅ **Volume calculations**
✅ **Delete functionality**
✅ **Responsive design**
✅ **Form validation**
✅ **Error handling**

Users can now fully track their training sessions!