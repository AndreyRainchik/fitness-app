import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsAPI, exercisesAPI, templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import { getLocalDateString } from '../utils/dateUtils';

function NewWorkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState(getLocalDateString());
  const [exercises, setExercises] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Template selection
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Autocomplete state (per focused input we store transient suggestions)
  // We'll keep a map of localExerciseId -> { query, suggestions, isOpen, highlightedIndex }
  const [acState, setAcState] = useState({}); // { [localId]: { query, suggestions, open, highlighted } }

  const acDebounceTimers = useRef({});

  // Helper: add a new exercise entry (local only)
  const handleAddExercise = () => {
    const localId = Date.now() + Math.floor(Math.random() * 1000);
    setExercises((prev) => [
      ...prev,
      { id: localId, exerciseId: null, exerciseName: '', sets: [] },
    ]);
    // init acState for this id
    setAcState((s) => ({ ...s, [localId]: { query: '', suggestions: [], open: false, highlighted: -1 } }));
  };
  const handleRemoveExercise = (exerciseId) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  // When the exerciseName input changes, update exercises[] and trigger search debounced
  const handleExerciseNameChange = (localId, name) => {
    // update exercises
    setExercises((prev) =>
      prev.map((ex) => (ex.id === localId ? { ...ex, exerciseName: name, exerciseId: null } : ex))
    );

    // update autocomplete state
    setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), query: name, open: false, highlighted: -1 } }));

    // if less than 2 characters, skip search
    if (!name || name.trim().length < 2) {
      // clear suggestions
      setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } }));
      return;
    }

    // debounce and call exercisesAPI.search
    if (acDebounceTimers.current[localId]) {
      clearTimeout(acDebounceTimers.current[localId]);
    }
    acDebounceTimers.current[localId] = setTimeout(async () => {
      try {
        const res = await exercisesAPI.search(name.trim());
        // API expected to return e.g. { exercises: [...] } or array — adapt to your backend shape.
        // We'll normalize: if res.exercises exists, use it, else if res is array, use it.
        const serverList = res?.exercises ?? res ?? [];
        // Each item should have at least { id, name }
        setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: serverList, open: serverList.length > 0, highlighted: -1 } }));
      } catch (err) {
        // on error, clear suggestions; optionally show error toast
        setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), suggestions: [], open: false, highlighted: -1 } }));
      } finally {
        delete acDebounceTimers.current[localId];
      }
    }, 250);
  };

  // When user selects a suggestion
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
            }];
          }
          
          return updated;
        }
        return ex;
      })
    );
    setAcState((s) => ({ ...s, [localId]: { ...(s[localId] || {}), open: false, suggestions: [], highlighted: -1 } }));
  };

  // Keyboard handling for autocomplete
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

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await templatesAPI.getAll();
      setTemplates(data.templates);
      setShowTemplateSelector(true);
    } catch (err) {
      alert('Failed to load templates: ' + err.message);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadFromTemplate = async (templateId) => {
    try {
      const data = await templatesAPI.getById(templateId);
      const template = data.template;
      
      // Set workout name from template
      setWorkoutName(template.name);
      
      // Sort sets by ID to maintain order
      const sortedSets = [...template.sets].sort((a, b) => a.id - b.id);
      
      // Group sets by exercise, BUT detect set_number resets for multiple instances
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
          const localId = `template-${set.exercise_id}-${Date.now()}-${Math.random()}`;
          currentBlock = {
            id: localId,
            exerciseId: set.exercise_id,
            exerciseName: set.exercise_name,
            sets: []
          };
          lastSetNumber = 0;
        }
        
        currentBlock.sets.push({
          id: Date.now() + Math.floor(Math.random() * 10000),
          setNumber: set.set_number,
          weight: set.weight.toString(),
          reps: set.reps.toString(),
          rpe: set.rpe?.toString() || '',
          isWarmup: set.is_warmup === 1
        });
        lastSetNumber = set.set_number;
      });
      
      // Push the last block
      if (currentBlock) {
        exerciseBlocks.push(currentBlock);
      }
      
      setExercises(exerciseBlocks);
      setShowTemplateSelector(false);
      
      // Show success message
      alert(`Loaded template: ${template.name}`);
    } catch (err) {
      alert('Failed to load template: ' + err.message);
    }
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
    let createdWorkout = null;

    try {
      // Create workout
      const workoutData = {
        name: workoutName,
        date: workoutDate,
        duration: 0 // We can add a timer later
      };

      const workout = await workoutsAPI.create(workoutData);
      createdWorkout = workout;

      // Add all sets for all exercises
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

      // Success! Navigate to workout page
      navigate(`/workout/${workout.workout.id}`);
    } catch (err) {
      if (createdWorkout?.id) {
        try {
          await workoutsAPI.delete(createdWorkout.id);
          console.warn('Rolled back workout', createdWorkout.id);
        } catch (deleteErr) {
          console.error('Rollback failed:', deleteErr);
        }
      }
      setError(err.message || 'Failed to save workout');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to render suggestions list for a local exercise entry
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
                // onMouseDown so click happens before blur
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

  // Cleanup timers if component unmounts
  useEffect(() => {
    return () => {
      Object.values(acDebounceTimers.current).forEach((t) => clearTimeout(t));
      acDebounceTimers.current = {};
    };
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-0">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Workout</h1>
              <p className="text-sm text-gray-600">Log your session</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link
                to="/templates"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200 text-center text-sm sm:text-base"
              >
                View Templates
              </Link>
              <button
                onClick={loadTemplates}
                disabled={loadingTemplates}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm sm:text-base"
              >
                {loadingTemplates ? 'Loading...' : 'Start from Template'}
              </button>
            </div>
          </div>
        </header>

        {error && <div className="mb-4 text-red-600">{error}</div>}

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Workout Name</label>
              <input
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="e.g., Upper Strength"
              />
            </div>

            <div className="w-full sm:w-40">
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
              <div key={exercise.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 sm:p-4 relative">
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
                          // open suggestions if any
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
                      {/* Suggestions (absolute) */}
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
                    {/* Header row - hidden on mobile, shown on sm+ */}
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div className="col-span-1"></div>
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-3">Weight</div>
                      <div className="col-span-2">Reps</div>
                      <div className="col-span-2">RPE</div>
                      <div className="col-span-3">Warm-up</div>
                    </div>

                    {exercise.sets.map((set) => (
                      <div key={set.id} className="mb-3 sm:mb-2">
                        {/* Mobile layout */}
                        <div className="sm:hidden bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Set {set.setNumber}</span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center text-xs text-gray-600 gap-1.5 cursor-pointer">
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
                                <span>Warm-up</span>
                              </label>
                              <button
                                onClick={() => handleRemoveSet(exercise.id, set.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete set"
                                disabled={isSaving}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Weight</label>
                              <input
                                type="number"
                                step="0.1"
                                value={set.weight}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                                className="w-full border rounded-md px-2 py-2 text-sm"
                                placeholder={user?.units || 'lbs'}
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Reps</label>
                              <input
                                type="number"
                                value={set.reps}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                                className="w-full border rounded-md px-2 py-2 text-sm"
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">RPE</label>
                              <select
                                value={set.rpe ?? ''}
                                onChange={(e) => handleSetChange(exercise.id, set.id, 'rpe', e.target.value)}
                                disabled={set.isWarmup || isSaving}
                                className="w-full border rounded-md px-2 py-2 bg-white text-sm"
                              >
                                <option value="">--</option>
                                {[...Array(11)].map((_, i) => (
                                  <option key={i} value={i}>{i}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden sm:grid sm:grid-cols-12 gap-2 items-center">
                          <div className="col-span-1 flex items-center justify-center">
                            <button
                              onClick={() => handleRemoveSet(exercise.id, set.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Delete set"
                              disabled={isSaving}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            <span className="text-gray-700 font-medium text-sm">{set.setNumber}</span>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.1"
                              value={set.weight}
                              onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                              className="w-full border rounded-md px-2 py-1.5 text-sm"
                              disabled={isSaving}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                              className="w-full border rounded-md px-2 py-1.5 text-sm"
                              disabled={isSaving}
                            />
                          </div>
                          <div className="col-span-2">
                            <select
                              value={set.rpe ?? ''}
                              onChange={(e) => handleSetChange(exercise.id, set.id, 'rpe', e.target.value)}
                              disabled={set.isWarmup || isSaving}
                              className="w-full border rounded-md px-2 py-1.5 bg-white text-sm"
                            >
                              <option value="">--</option>
                              {[...Array(11)].map((_, i) => (
                                <option key={i} value={i}>{i}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="flex items-center text-xs text-gray-600 gap-1.5 cursor-pointer">
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
                              <span>Warm-up</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAddSet(exercise.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    + Add Set
                  </button>
                  <span className="text-sm text-gray-500">
                    {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <button
              onClick={handleAddExercise}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              + Add Exercise
            </button>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
              <button
                onClick={handleSaveWorkout}
                disabled={isSaving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 order-1 sm:order-1"
              >
                {isSaving ? 'Saving...' : 'Save Workout'}
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200 order-2 sm:order-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Template Selector Modal */}
        {showTemplateSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Choose a Template</h2>
                <button
                  onClick={() => setShowTemplateSelector(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No templates saved yet</p>
                  <Link
                    to="/workouts"
                    onClick={() => setShowTemplateSelector(false)}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Save a workout as a template first
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition"
                      onClick={() => loadFromTemplate(template.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>{template.exercise_count} exercises</span>
                            <span>{template.total_sets} sets</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadFromTemplate(template.id);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default NewWorkout;