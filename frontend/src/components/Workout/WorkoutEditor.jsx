import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ExerciseNameInput from './ExerciseNameInput';
import SetRow from './SetRow';
import { Alert, Button, Card } from '../ui';
import {
  buildSetsPayload,
  emptyExercise,
  emptySet,
  validateWorkout
} from '../../utils/workoutPayload';

/**
 * Shared workout form used by New, Active and Edit Workout.
 *
 * Props:
 * - initialValues: { name, date, notes, exercises } (exercises in editor shape,
 *   see utils/workoutPayload.js). Read once on mount; remount with a new `key`
 *   to load different values (e.g. after picking a template).
 * - onSubmit(values): async. Called after validation with
 *   { name, date, notes, exercises, sets } where `sets` is the API payload.
 *   Throw to show an error. Return false if the user backed out (e.g. a
 *   confirm dialog), which just ends the saving state.
 * - onCancel(): Cancel button handler.
 * - submitLabel / savingLabel: text for the primary button.
 * - namePlaceholder: placeholder for the workout name.
 * - onSetAdded(): called after a set is added (Active Workout starts the rest timer).
 * - renderExerciseActions(exercise, { disabled }): extra buttons next to "+ Add Set".
 */
function WorkoutEditor({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save Workout',
  savingLabel = 'Saving...',
  namePlaceholder = 'e.g., Upper Strength',
  onSetAdded,
  renderExerciseActions
}) {
  const { user } = useAuth();
  const units = user?.units || 'lbs';

  const [name, setName] = useState(initialValues.name ?? '');
  const [date, setDate] = useState(initialValues.date ?? '');
  const [notes, setNotes] = useState(initialValues.notes ?? '');
  const [exercises, setExercises] = useState(initialValues.exercises ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const updateExercise = (exerciseId, update) => {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? update(ex) : ex)));
  };

  const handleAddExercise = () => setExercises((prev) => [...prev, emptyExercise()]);

  const handleRemoveExercise = (exerciseId) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  };

  const handleExerciseNameChange = (exerciseId, exerciseName) => {
    // Typing un-matches the exercise until a suggestion is picked again
    updateExercise(exerciseId, (ex) => ({ ...ex, exerciseName, exerciseId: null }));
  };

  const handleSelectExercise = (exerciseId, suggestion) => {
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      exerciseId: suggestion.id,
      exerciseName: suggestion.name,
      sets: ex.sets.length > 0 ? ex.sets : [emptySet(1)]
    }));
  };

  const handleAddSet = (exerciseId) => {
    updateExercise(exerciseId, (ex) => ({ ...ex, sets: [...ex.sets, emptySet(ex.sets.length + 1)] }));
    onSetAdded?.();
  };

  const handleRemoveSet = (exerciseId, setId) => {
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets
        .filter((s) => s.id !== setId)
        .map((s, i) => ({ ...s, setNumber: i + 1 }))
    }));
  };

  const handleSetChange = (exerciseId, setId, field, value) => {
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => {
        if (s.id !== setId) return s;
        // Warm-up sets don't get an RPE
        if (field === 'isWarmup') return { ...s, isWarmup: value, rpe: value ? '' : s.rpe };
        return { ...s, [field]: value };
      })
    }));
  };

  const handleSubmit = async () => {
    setError('');
    const validationError = validateWorkout({ name, exercises });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        date,
        notes: notes.trim(),
        exercises,
        sets: buildSetsPayload(exercises)
      });
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      // Harmless if onSubmit navigated away and this component unmounted
      setIsSaving(false);
    }
  };

  return (
    <>
      {error && (
        <Alert className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="workout-name" className="block text-sm font-medium text-gray-700 mb-1">
              Workout Name
            </label>
            <input
              id="workout-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder={namePlaceholder}
              disabled={isSaving}
            />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="workout-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="workout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-6">
          {exercises.map((exercise) => (
            <div key={exercise.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exercise</label>
                  <ExerciseNameInput
                    value={exercise.exerciseName}
                    onChange={(value) => handleExerciseNameChange(exercise.id, value)}
                    onSelect={(suggestion) => handleSelectExercise(exercise.id, suggestion)}
                    disabled={isSaving}
                  />
                  {!exercise.exerciseId && (
                    <p className="text-xs text-gray-500 mt-1">Type at least 2 characters, then pick from the list</p>
                  )}
                </div>
                <Button
                  variant="danger-subtle"
                  size="sm"
                  onClick={() => handleRemoveExercise(exercise.id)}
                  className="ml-4 flex-shrink-0 mt-6"
                  disabled={isSaving}
                  aria-label={`Remove ${exercise.exerciseName || 'exercise'}`}
                >
                  Remove
                </Button>
              </div>

              {exercise.sets.length > 0 && (
                <div className="mb-4">
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <div className="col-span-1"></div>
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-3">Weight ({units})</div>
                    <div className="col-span-2">Reps</div>
                    <div className="col-span-2">RPE</div>
                    <div className="col-span-3">Warm-up</div>
                  </div>
                  {exercise.sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      units={units}
                      onChange={(field, value) => handleSetChange(exercise.id, set.id, field, value)}
                      onRemove={() => handleRemoveSet(exercise.id, set.id)}
                      disabled={isSaving}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button variant="secondary" onClick={() => handleAddSet(exercise.id)} disabled={isSaving}>
                  + Add Set
                </Button>
                {renderExerciseActions?.(exercise, { disabled: isSaving })}
                <span className="text-sm text-gray-500">
                  {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          <Button variant="secondary" size="lg" fullWidth onClick={handleAddExercise} disabled={isSaving}>
            + Add Exercise
          </Button>

          <div>
            <label htmlFor="workout-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="workout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the workout feel? Any observations?"
              rows={3}
              className="w-full border rounded-md px-3 py-2 resize-y"
              disabled={isSaving}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button size="lg" className="flex-1" onClick={handleSubmit} loading={isSaving} loadingText={savingLabel}>
              {submitLabel}
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

export default WorkoutEditor;
