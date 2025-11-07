import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsAPI } from '../services/api';
import { exercisesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';

function NewWorkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [exercises, setExercises] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddExercise = () => {
    // For now, we'll add a placeholder
    // Next step will be to add exercise search
    setExercises([
      ...exercises,
      {
        id: Date.now(),
        exerciseName: '',
        sets: []
      }
    ]);
  };

  const handleRemoveExercise = (exerciseId) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  const handleExerciseNameChange = (exerciseId, name) => {
    setExercises(exercises.map(ex =>
      ex.id === exerciseId ? { ...ex, exerciseName: name } : ex
    ));
  };

  const handleAddSet = (exerciseId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const setNumber = ex.sets.length + 1;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: Date.now(),
              setNumber,
              weight: '',
              reps: '',
              rpe: ''
            }
          ]
        };
      }
      return ex;
    }));
  };

  const handleRemoveSet = (exerciseId, setId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const updatedSets = ex.sets
          .filter(set => set.id !== setId)
          .map((set, index) => ({ ...set, setNumber: index + 1 }));
        return { ...ex, sets: updatedSets };
      }
      return ex;
    }));
  };

  const handleSetChange = (exerciseId, setId, field, value) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.map(set =>
            set.id === setId ? { ...set, [field]: value } : set
          )
        };
      }
      return ex;
    }));
  };

  const handleSaveWorkout = async () => {
    setError('');

    // Validation
    if (!workoutName.trim()) {
      setError('Please enter a workout name');
      return;
    }

    if (exercises.length === 0) {
      setError('Please add at least one exercise');
      return;
    }

    // Check that all exercises have names
    const hasEmptyExercise = exercises.some(ex => !ex.exerciseName.trim());
    if (hasEmptyExercise) {
      setError('Please enter names for all exercises');
      return;
    }

    // Check that all exercises have at least one set
    const hasExerciseWithoutSets = exercises.some(ex => ex.sets.length === 0);
    if (hasExerciseWithoutSets) {
      setError('Each exercise must have at least one set');
      return;
    }

    setIsSaving(true);

    try {
      // Create workout
      const workoutData = {
        name: workoutName,
        date: workoutDate,
        duration: 0 // We can add a timer later
      };

      const workout = await workoutsAPI.create(workoutData);
      console.log(workout);

      // Add all sets for all exercises
      for (const exercise of exercises) {
        console.log(exercise);
        const exerciseSearch = await exercisesAPI.search(exercise.exerciseName);
        console.log(exerciseSearch);
        for (const set of exercise.sets) {
          await workoutsAPI.addSet(workout.workout.id, {
            exercise_id: exerciseSearch.exercises[0].id,
            set_number: set.setNumber,
            weight: parseFloat(set.weight) || 0,
            reps: parseInt(set.reps) || 0,
            rpe: set.rpe ? parseInt(set.rpe) : null
          });
        }
      }

      // Success! Navigate to workouts page
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Log Workout</h1>
          <p className="text-gray-600">Track your training session</p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Workout Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Workout Details</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workout Name
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Upper Body Day"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-6 mb-6">
          {exercises.map((exercise, exerciseIndex) => (
            <div key={exercise.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Exercise {exerciseIndex + 1}
                </h3>
                <button
                  onClick={() => handleRemoveExercise(exercise.id)}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>

              {/* Exercise Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exercise Name
                </label>
                <input
                  type="text"
                  value={exercise.exerciseName}
                  onChange={(e) => handleExerciseNameChange(exercise.id, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Bench Press, Squat"
                />
              </div>

              {/* Sets */}
              {exercise.sets.length > 0 && (
                <div className="mb-4">
                  <div className="grid grid-cols-12 gap-2 mb-2 text-sm font-medium text-gray-700">
                    <div className="col-span-2">Set</div>
                    <div className="col-span-3">Weight ({user?.units || 'lbs'})</div>
                    <div className="col-span-3">Reps</div>
                    <div className="col-span-3">RPE</div>
                    <div className="col-span-1"></div>
                  </div>

                  {exercise.sets.map((set) => (
                    <div key={set.id} className="grid grid-cols-12 gap-2 mb-2">
                      <div className="col-span-2 flex items-center">
                        <span className="text-gray-600">{set.setNumber}</span>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={set.weight}
                          onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="185"
                          step="0.5"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="10"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={set.rpe}
                          onChange={(e) => handleSetChange(exercise.id, set.id, 'rpe', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="8"
                          min="1"
                          max="10"
                        />
                      </div>
                      <div className="col-span-1 flex items-center">
                        <button
                          onClick={() => handleRemoveSet(exercise.id, set.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Set Button */}
              <button
                onClick={() => handleAddSet(exercise.id)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                + Add Set
              </button>
            </div>
          ))}
        </div>

        {/* Add Exercise Button */}
        <button
          onClick={handleAddExercise}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 mb-6"
        >
          + Add Exercise
        </button>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSaveWorkout}
            disabled={isSaving}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            {isSaving ? 'Saving...' : 'Save Workout'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default NewWorkout;