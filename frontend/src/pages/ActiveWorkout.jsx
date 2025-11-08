import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useBeforeUnload } from 'react-router-dom';
import { workoutsAPI, exercisesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import WorkoutTimer from '../components/Timers/WorkoutTimer';
import RestTimer from '../components/Timers/RestTimer';

function ActiveWorkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Core workout state
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [exercises, setExercises] = useState([]);
  const [notes, setNotes] = useState('');
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [totalSeconds, setTotalSeconds] = useState(0);
  
  // Rest timer state
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restDuration, setRestDuration] = useState(180); // 3 minutes default
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Autocomplete state
  const [acState, setAcState] = useState({});
  const acDebounceTimers = useRef({});

  // Prevent navigation away from active workout
  useBeforeUnload(
    React.useCallback((e) => {
      e.preventDefault();
      e.returnValue = '';
    }, [])
  );

  // Prevent back button
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (exercises.length > 0 || workoutName) {
        e.preventDefault();
        e.returnValue = 'You have an active workout. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [exercises, workoutName]);

  // Load template if provided in location state
  useEffect(() => {
    if (location.state?.template) {
      const template = location.state.template;
      
      // Set workout name from template
      setWorkoutName(template.name || '');
      
      // Convert template sets to exercise format
      if (template.sets && template.sets.length > 0) {
        const sortedSets = [...template.sets].sort((a, b) => a.id - b.id);
        
        // Group sets by exercise, detecting when set_number resets
        const exerciseBlocks = [];
        let currentBlock = null;
        let lastSetNumber = 0;
        
        sortedSets.forEach(set => {
          // Start new block if:
          // 1. No current block
          // 2. Exercise changes
          // 3. Set number resets (indicates new instance of same exercise)
          const setNumberReset = currentBlock && 
                                currentBlock.exerciseId === set.exercise_id && 
                                set.set_number <= lastSetNumber;
          
          if (!currentBlock || 
              currentBlock.exerciseId !== set.exercise_id || 
              setNumberReset) {
            if (currentBlock) {
              exerciseBlocks.push(currentBlock);
            }
            const localId = Date.now() + Math.floor(Math.random() * 10000);
            currentBlock = {
              id: localId,
              exerciseId: set.exercise_id,
              exerciseName: set.exercise_name,
              sets: []
            };
            lastSetNumber = 0;
          }
          
          // Add set to current block
          currentBlock.sets.push({
            id: Date.now() + Math.floor(Math.random() * 10000),
            setNumber: set.set_number,
            weight: set.weight.toString(),
            reps: set.reps.toString(),
            rpe: set.rpe ? set.rpe.toString() : '',
            isWarmup: set.is_warmup === 1
          });
          lastSetNumber = set.set_number;
        });
        
        // Push the last block
        if (currentBlock) {
          exerciseBlocks.push(currentBlock);
        }
        
        setExercises(exerciseBlocks);
        
        // Initialize autocomplete state for all exercises
        const newAcState = {};
        exerciseBlocks.forEach(ex => {
          newAcState[ex.id] = { query: '', suggestions: [], open: false, highlighted: -1 };
        });
        setAcState(newAcState);
      }
    }
  }, [location.state]);

  // Helper: add a new exercise entry
  const handleAddExercise = () => {
    const localId = Date.now() + Math.floor(Math.random() * 1000);
    setExercises((prev) => [
      ...prev,
      { id: localId, exerciseId: null, exerciseName: '', sets: [] },
    ]);
    setAcState((s) => ({ 
      ...s, 
      [localId]: { query: '', suggestions: [], open: false, highlighted: -1 } 
    }));
  };

  const handleRemoveExercise = (exerciseId) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  // Exercise name change with autocomplete
  const handleExerciseNameChange = (localId, name) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === localId ? { ...ex, exerciseName: name, exerciseId: null } : ex))
    );

    setAcState((s) => ({ 
      ...s, 
      [localId]: { ...(s[localId] || {}), query: name, open: false, highlighted: -1 } 
    }));

    if (!name || name.trim().length < 2) {
      setAcState((s) => ({ 
        ...s, 
        [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } 
      }));
      return;
    }

    if (acDebounceTimers.current[localId]) {
      clearTimeout(acDebounceTimers.current[localId]);
    }
    
    acDebounceTimers.current[localId] = setTimeout(async () => {
      try {
        const res = await exercisesAPI.search(name.trim());
        const serverList = res?.exercises ?? res ?? [];
        setAcState((s) => ({ 
          ...s, 
          [localId]: { 
            ...(s[localId] || {}), 
            suggestions: serverList, 
            open: serverList.length > 0, 
            highlighted: -1 
          } 
        }));
      } catch (err) {
        setAcState((s) => ({ 
          ...s, 
          [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } 
        }));
      } finally {
        delete acDebounceTimers.current[localId];
      }
    }, 250);
  };

  const handleSelectSuggestion = (localId, suggestion) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === localId) {
          const updated = { ...ex, exerciseId: suggestion.id, exerciseName: suggestion.name };
          
          if (updated.sets.length === 0) {
            updated.sets = [{
              id: Date.now() + Math.floor(Math.random() * 1000),
              setNumber: 1,
              weight: '',
              reps: '',
              rpe: '',
              isWarmup: false,
            }];
          }
          
          return updated;
        }
        return ex;
      })
    );
    setAcState((s) => ({ 
      ...s, 
      [localId]: { ...(s[localId] || {}), open: false, suggestions: [], highlighted: -1 } 
    }));
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

  // Set management
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
                },
              ],
            }
          : ex
      )
    );
    
    // Start rest timer after adding set
    if (!isRestTimerActive) {
      setIsRestTimerActive(true);
    }
  };

  const handleRemoveSet = (localId, setId) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === localId
          ? { 
              ...ex, 
              sets: ex.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 })) 
            }
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

  // Timer controls
  const handlePauseResume = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleRestTimerComplete = () => {
    setIsRestTimerActive(false);
  };

  const handleRestTimerSkip = () => {
    setIsRestTimerActive(false);
  };

  // Finish workout
  const handleFinishWorkout = async () => {
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

    const confirmFinish = window.confirm(
      `Finish workout "${workoutName}"?\n\nDuration: ${Math.floor(totalSeconds / 60)} minutes\nExercises: ${exercises.length}`
    );

    if (!confirmFinish) return;

    setIsSaving(true);

    try {
      // Create workout with duration
      var workoutData = {
          name: workoutName,
          date: workoutDate,
          duration: Math.floor(totalSeconds / 60), // Convert to minutes
      };
      if (notes) {
        workoutData.notes = notes.trim();
      }

      const workout = await workoutsAPI.create(workoutData);

      // Add all sets
      for (const exercise of exercises) {
        for (const set of exercise.sets) {
          if (set.rpe) {
                await workoutsAPI.addSet(workout.workout.id, {
                exercise_id: exercise.exerciseId,
                set_number: set.setNumber,
                weight: parseFloat(set.weight) || 0,
                reps: parseInt(set.reps) || 0,
                rpe: set.rpe ? parseInt(set.rpe) : null,
                is_warmup: set.isWarmup
                });
            } else {
                await workoutsAPI.addSet(workout.workout.id, {
                exercise_id: exercise.exerciseId,
                set_number: set.setNumber,
                weight: parseFloat(set.weight) || 0,
                reps: parseInt(set.reps) || 0,
                is_warmup: set.isWarmup
                });
            }
        }
      }

      // Navigate to workout detail
      navigate(`/workout/${workout.workout.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save workout:', err);
      setError('Failed to save workout: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this workout? All progress will be lost.'
    );
    
    if (confirmCancel) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <Layout>
      {/* Sticky header with timer and controls */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg mb-6 -mx-4 px-4 py-6 md:-mx-6 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">Active Workout</h1>
              {location.state?.fromTemplate && (
                <span className="px-3 py-1 bg-white bg-opacity-20 text-white text-sm font-medium rounded-full">
                  📋 From Template
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePauseResume}
                className={`px-4 py-2 rounded-lg font-semibold transition duration-200 ${
                  isTimerRunning
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isTimerRunning ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition duration-200"
              >
                ❌ Cancel
              </button>
            </div>
          </div>
          
          <WorkoutTimer 
            isRunning={isTimerRunning} 
            onTimeUpdate={setTotalSeconds}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Workout Name and Date */}
          <div className="grid grid-cols-12 gap-4 items-center mb-6">
            <div className="col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workout Name
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g., Push Day, Leg Day"
                className="w-full border rounded-md px-3 py-2"
                disabled={isSaving}
              />
            </div>
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                disabled={isSaving}
              />
            </div>
            </div>

          {/* Exercise list */}
          <div className="space-y-6">
            {exercises.map((exercise, exIndex) => {
            const state = acState[exercise.id] || { suggestions: [], open: false, highlighted: -1 };
            
            return (
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
                        className="w-full border rounded-md px-3 py-2"
                        disabled={isSaving}
                      />
                      {/* Suggestions */}
                      {state.open && state.suggestions.length > 0 && (
                        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                          {state.suggestions.map((sug, idx) => {
                            const isHighlighted = idx === state.highlighted;
                            return (
                              <li
                                key={sug.id ?? `${sug.name}-${idx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectSuggestion(exercise.id, sug);
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
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Tip: type at least 2 characters</div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleRemoveExercise(exercise.id)}
                      className="text-sm text-red-600 hover:underline"
                      title="Remove exercise"
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Sets */}
                {exercise.sets.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-12 gap-2 mb-2 text-sm font-medium text-gray-700">
                        <div className="col-span-1"></div>
                        <div className="col-span-1">Set</div>
                        <div className="col-span-3">Weight ({user?.units || 'lbs'})</div>
                        <div className="col-span-2">Reps</div>
                        <div className="col-span-4">RPE</div>
                    </div>

                    {exercise.sets.map((set) => (
                        <div key={set.id} className="grid grid-cols-12 gap-2 mb-2">
                            {/* Delete button - far left for safety */}
                            <div className="col-span-1 flex items-center">
                            <button
                                onClick={() => handleRemoveSet(exercise.id, set.id)}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Delete set"
                                disabled={isSaving}
                            >
                                ✕
                            </button>
                            </div>

                            {/* Set number - reduced from 2 columns to 1 */}
                            <div className="col-span-1 flex items-center justify-center">
                            <span className="text-gray-700 font-medium">{set.setNumber}</span>
                            </div>

                            <div className="col-span-3">
                            <input
                                type="number"
                                step="0.1"
                                value={set.weight}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm"
                                disabled={isSaving}
                            />
                            </div>

                            <div className="col-span-2">
                            <input
                                type="number"
                                value={set.reps}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                                className="w-full border rounded-md px-2 py-1 text-sm"
                                disabled={isSaving}
                            />
                            </div>

                            {/* RPE + Warmup - increased from 3 columns to 4! */}
                            <div className="col-span-4">
                            <div className="flex items-center gap-2">
                                {/* RPE dropdown */}
                                <select
                                value={set.rpe ?? ''}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'rpe', e.target.value)}
                                disabled={set.isWarmup || isSaving}
                                className="w-16 sm:w-20 border rounded-md px-2 py-1 bg-white text-sm flex-shrink-0"
                                >
                                <option value="">--</option>
                                {[...Array(11)].map((_, i) => (
                                    <option key={i} value={i}>
                                    {i}
                                    </option>
                                ))}
                                </select>

                                {/* Warm-up toggle - now has room for label even on mobile! */}
                                <label 
                                className="flex items-center text-xs text-gray-600 gap-1.5 cursor-pointer whitespace-nowrap" 
                                title="Mark as warm-up set"
                                >
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
                                    disabled={isSaving}
                                    className="rounded w-4 h-4"
                                />
                                {/* Show abbreviated on mobile, full text on desktop */}
                                <span className="hidden sm:inline">Warm-up</span>
                                <span className="sm:hidden">WU</span>
                                </label>
                            </div>
                            </div>
                        </div>
                        ))}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => handleAddSet(exercise.id)}
                        disabled={!exercise.exerciseName || isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:bg-blue-400 transition-colors"
                    >
                        + Add Set
                    </button>
                    <button
                        onClick={() => setIsRestTimerActive(true)}
                        disabled={isSaving}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:bg-green-400 transition-colors flex items-center gap-2"
                        title="Start rest timer (3:00)"
                    >
                        <span className="text-base">⏱️</span>
                        <span className="hidden sm:inline">Start Rest</span>
                    </button>
                    <div className="text-sm text-gray-500 self-center">
                        {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                    </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Exercise Button */}
        <div className="mt-6">
          <button
            onClick={handleAddExercise}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:bg-blue-400 mb-6"
          >
            + Add Exercise
          </button>

          {/* Workout Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workout Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the workout feel? Any observations?"
              rows="4"
              className="w-full border rounded-md px-3 py-2 resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleFinishWorkout}
              disabled={isSaving || exercises.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              {isSaving ? 'Saving...' : '✅ Finish Workout'}
            </button>

            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Rest Timer (appears at bottom when active) */}
      <RestTimer
        duration={restDuration}
        isActive={isRestTimerActive}
        onComplete={handleRestTimerComplete}
        onSkip={handleRestTimerSkip}
      />
    </Layout>
  );
}

export default ActiveWorkout;