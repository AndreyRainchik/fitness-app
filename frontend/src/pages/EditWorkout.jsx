import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsAPI, exercisesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';

function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState('');
  const [exercises, setExercises] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Autocomplete state
  const [acState, setAcState] = useState({});
  const acDebounceTimers = useRef({});

  // Load existing workout data
  useEffect(() => {
    fetchWorkout();
  }, [id]);

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      const data = await workoutsAPI.getById(id);
      const workout = data.workout;
      
      setWorkoutName(workout.name || '');
      setWorkoutDate(workout.date);

      // Group sets by exercise
      const exerciseGroups = {};
      workout.sets.forEach(set => {
        if (!exerciseGroups[set.exercise_id]) {
          exerciseGroups[set.exercise_id] = {
            id: `existing-${set.exercise_id}-${Date.now()}`,
            exerciseId: set.exercise_id,
            exerciseName: set.exercise_name,
            sets: []
          };
        }
        exerciseGroups[set.exercise_id].sets.push({
          id: set.id, // Keep the original set ID
          existingSetId: set.id, // Track this is an existing set
          setNumber: set.set_number,
          weight: set.weight.toString(),
          reps: set.reps.toString(),
          rpe: set.rpe?.toString() || '',
          isWarmup: set.is_warmup === 1
        });
      });

      setExercises(Object.values(exerciseGroups));
    } catch (err) {
      setError(err.message || 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  // Helper: add a new exercise entry
  const handleAddExercise = () => {
    const localId = Date.now() + Math.floor(Math.random() * 1000);
    setExercises((prev) => [
      ...prev,
      { id: localId, exerciseId: null, exerciseName: '', sets: [] },
    ]);
    setAcState((s) => ({ ...s, [localId]: { query: '', suggestions: [], open: false, highlighted: -1 } }));
  };

  const handleRemoveExercise = (exerciseId) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  // Exercise name change with autocomplete
  const handleExerciseNameChange = (localId, name) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === localId ? { ...ex, exerciseName: name, exerciseId: null } : ex))
    );

    setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), query: name, open: false, highlighted: -1 } }));

    if (!name || name.trim().length < 2) {
      setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } }));
      return;
    }

    if (acDebounceTimers.current[localId]) {
      clearTimeout(acDebounceTimers.current[localId]);
    }
    acDebounceTimers.current[localId] = setTimeout(async () => {
      try {
        const res = await exercisesAPI.search(name.trim());
        const serverList = res?.exercises ?? res ?? [];
        setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: serverList, open: serverList.length > 0, highlighted: -1 } }));
      } catch (err) {
        setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } }));
      } finally {
        delete acDebounceTimers.current[localId];
      }
    }, 250);
  };

  const handleSelectSuggestion = (localId, suggestion) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === localId) {
          // Update exercise info
          const updated = { ...ex, exerciseId: suggestion.id, exerciseName: suggestion.name };
          
          // Auto-add first set if none exist
          if (updated.sets.length === 0) {
            updated.sets = [{
              id: Date.now() + Math.floor(Math.random() * 1000),
              setNumber: 1,
              weight: '',
              reps: '',
              rpe: '',
              isWarmup: false,
              // No existingSetId - this is a new set
            }];
          }
          
          return updated;
        }
        return ex;
      })
    );
    setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), open: false, suggestions: [], highlighted: -1 } }));
  };

  const handleKeyDown = (e, localId) => {
    const state = acState[localId] || { suggestions: [], highlighted: -1, open: false };
    const list = state.suggestions || [];
    if (!state.open || list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(state.highlighted + 1, list.length - 1);
      setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), highlighted: next } }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(state.highlighted - 1, 0);
      setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), highlighted: prev } }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = state.highlighted >= 0 ? state.highlighted : 0;
      const suggestion = list[idx];
      if (suggestion) {
        handleSelectSuggestion(localId, suggestion);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), open: false, highlighted: -1 } }));
    }
  };

  // Add a set for an exercise
  const handleAddSet = (localId) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === localId
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  setNumber: ex.sets.length + 1,
                  weight: '',
                  reps: '',
                  rpe: '',
                  isWarmup: false,
                  // No existingSetId - this is a new set
                },
              ],
            }
          : ex
      )
    );
  };

  const handleRemoveSet = (localId, setId) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === localId
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 })) }
          : ex
      )
    );
  };

  const handleSetChange = (localId, setId, field, value) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === localId
          ? {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                if (field === 'isWarmup') {
                  return { ...s, isWarmup: value, rpe: value ? null : s.rpe };
                }
                return { ...s, [field]: value };
              }),
            }
          : ex
      )
    );
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

    const hasEmptyExercise = exercises.some(ex => !ex.exerciseName.trim());
    if (hasEmptyExercise) {
      setError('Please enter names for all exercises');
      return;
    }

    const hasExerciseWithoutSets = exercises.some(ex => ex.sets.length === 0);
    if (hasExerciseWithoutSets) {
      setError('Each exercise must have at least one set');
      return;
    }

    setIsSaving(true);

    try {
      // Update workout metadata
      await workoutsAPI.update(id, {
        name: workoutName,
        date: workoutDate
      });

      // Get all current set IDs from the workout
      const currentWorkout = await workoutsAPI.getById(id);
      const existingSetIds = currentWorkout.workout.sets.map(s => s.id);

      // Track which sets to keep
      const setsToKeep = new Set();

      // Process all exercises and sets
      for (const exercise of exercises) {
        for (const set of exercise.sets) {
          if (set.existingSetId) {
            // Update existing set
            setsToKeep.add(set.existingSetId);
            if (set.rpe) {
                await workoutsAPI.updateSet(set.existingSetId, {
                    set_number: set.setNumber,
                    weight: parseFloat(set.weight) || 0,
                    reps: parseInt(set.reps) || 0,
                    rpe: set.rpe ? parseInt(set.rpe) : null,
                    is_warmup: set.isWarmup
                });
            } else {
                await workoutsAPI.updateSet(set.existingSetId, {
                    set_number: set.setNumber,
                    weight: parseFloat(set.weight) || 0,
                    reps: parseInt(set.reps) || 0,
                    is_warmup: set.isWarmup
                });
            }
          } else {
            if (set.rpe) {
                const newSet = await workoutsAPI.addSet(id, {
                    exercise_id: exercise.exerciseId,
                    set_number: set.setNumber,
                    weight: parseFloat(set.weight) || 0,
                    reps: parseInt(set.reps) || 0,
                    rpe: set.rpe ? parseInt(set.rpe) : null,
                    is_warmup: set.isWarmup
                });
                setsToKeep.add(newSet.set.id);
            } else {
                const newSet = await workoutsAPI.addSet(id, {
                    exercise_id: exercise.exerciseId,
                    set_number: set.setNumber,
                    weight: parseFloat(set.weight) || 0,
                    reps: parseInt(set.reps) || 0,
                    is_warmup: set.isWarmup
                });
                setsToKeep.add(newSet.set.id);
            }
          }
        }
      }

      // Delete sets that were removed
      for (const existingId of existingSetIds) {
        if (!setsToKeep.has(existingId)) {
          await workoutsAPI.deleteSet(existingId);
        }
      }

      // Success! Navigate to workout detail page
      navigate(`/workout/${id}`);
    } catch (err) {
      setError(err.message || 'Failed to update workout');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSuggestions = (localId) => {
    const state = acState[localId] || { suggestions: [], open: false, highlighted: -1 };
    if (!state.open || !state.suggestions || state.suggestions.length === 0) return null;

    return (
      <ul
        role="listbox"
        aria-label="Exercise suggestions"
        className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto"
      >
        {state.suggestions.map((sug, idx) => {
          const isHighlighted = idx === state.highlighted;
          return (
            <li
              key={sug.id ?? `${sug.name}-${idx}`}
              role="option"
              aria-selected={isHighlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(localId, sug);
              }}
              className={`px-3 py-2 cursor-pointer ${isHighlighted ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-gray-900">{sug.name}</div>
                {sug.primary_muscle_group && <div className="text-xs text-gray-500">{sug.primary_muscle_group}</div>}
              </div>
              {sug.equipment && <div className="text-xs text-gray-400 mt-1">{sug.equipment}</div>}
            </li>
          );
        })}
      </ul>
    );
  };

  useEffect(() => {
    return () => {
      Object.values(acDebounceTimers.current).forEach((t) => clearTimeout(t));
      acDebounceTimers.current = {};
    };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Workout</h1>
          <p className="text-sm text-gray-600">Update your workout session</p>
        </header>

        {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-12 gap-4 items-center mb-6">
            <div className="col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-1">Workout Name</label>
              <input
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="e.g., Upper Strength"
              />
            </div>

            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                type="date"
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* Exercise list */}
          <div className="space-y-6">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="bg-gray-50 border border-gray-100 rounded-md p-4 relative">
                <div className="flex justify-between items-start mb-3">
                  <div style={{ flex: 1 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exercise</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={exercise.exerciseName}
                        onChange={(e) => handleExerciseNameChange(exercise.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, exercise.id)}
                        onFocus={() => {
                          const st = acState[exercise.id] || {};
                          if (st.suggestions && st.suggestions.length > 0) {
                            setAcState((s) => ({ ...s, [exercise.id]: { ...(s[exercise.id] || {}), open: true } }));
                          }
                        }}
                        placeholder="Start typing exercise name..."
                        aria-autocomplete="list"
                        aria-controls={`ac-list-${exercise.id}`}
                        aria-expanded={(acState[exercise.id] && acState[exercise.id].open) ? true : false}
                        className="w-full border rounded-md px-3 py-2"
                      />
                      <div className="mt-1">{renderSuggestions(exercise.id)}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Tip: type at least 2 characters</div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleRemoveExercise(exercise.id)}
                      className="text-sm text-red-600 hover:underline"
                      title="Remove exercise"
                    >
                      Remove
                    </button>
                  </div>
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
                          <span className="text-gray-700">{set.setNumber}</span>
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            value={set.weight}
                            onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                            className="w-full border rounded-md px-2 py-1"
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                            className="w-full border rounded-md px-2 py-1"
                          />
                        </div>

                        <div className="col-span-3 flex items-center gap-2">
                          <select
                            value={set.rpe ?? ''}
                            onChange={(e) => handleSetChange(exercise.id, set.id, 'rpe', e.target.value)}
                            disabled={set.isWarmup}
                            className="w-20 border rounded-md px-2 py-1 bg-white"
                          >
                            <option value="">--</option>
                            {[...Array(11)].map((_, i) => (
                              <option key={i} value={i}>
                                {i}
                              </option>
                            ))}
                          </select>

                          <label className="flex items-center text-xs text-gray-600 gap-1">
                            <input
                              type="checkbox"
                              checked={!!set.isWarmup}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                handleSetChange(exercise.id, set.id, 'isWarmup', checked);
                                if (checked) {
                                  handleSetChange(exercise.id, set.id, 'rpe', null);
                                }
                              }}
                            />
                            Warm-up
                          </label>
                        </div>

                        <div className="col-span-1">
                          <button
                            onClick={() => handleRemoveSet(exercise.id, set.id)}
                            className="text-sm text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddSet(exercise.id)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                  >
                    + Add Set
                  </button>
                  <div className="text-sm text-gray-500 self-center">
                    {exercise.sets.length} sets
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={handleAddExercise}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 mb-6"
            >
              + Add Exercise
            </button>

            <div className="flex gap-4">
              <button
                onClick={handleSaveWorkout}
                disabled={isSaving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={() => navigate(`/workout/${id}`)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default EditWorkout;