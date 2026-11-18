import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { History, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ExerciseNameInput from './ExerciseNameInput';
import SetRow, { SetRowHeader } from './SetRow';
import { Alert, Button, Card, Input, Textarea } from '../ui';
import {
  buildSetsPayload,
  emptyExercise,
  emptySet,
  setsFromLastPerformance,
  validateWorkout
} from '../../utils/workoutPayload';
import { clearLastPerformanceCache, useLastPerformance } from '../../utils/useLastPerformance';
import { formatDate } from '../../utils/format';

const fmt = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

/** One exercise block: name, "last time", sets, and actions. */
function ExerciseBlock({
  index, exercise, units, disabled, trackCompletion, excludeWorkoutId,
  onNameChange, onSelect, onRemove, onAddSet, onRemoveSet, onSetChange, onToggleDone, onUseLast, extraActions
}) {
  const last = useLastPerformance(exercise.exerciseId, excludeWorkoutId);
  const lastWorking = last?.sets ?? [];
  const allEmpty = exercise.sets.every((s) => s.weight === '' && s.reps === '');
  const doneCount = exercise.sets.filter((s) => s.done).length;

  return (
    <Card padding="p-2.5 sm:p-5" className="animate-fade-in">
      <div className="mb-3 flex items-start gap-2 sm:gap-3">
        <span className="mt-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <ExerciseNameInput value={exercise.exerciseName} onChange={onNameChange} onSelect={onSelect} disabled={disabled} />
          {!exercise.exerciseId ? (
            <p className="mt-1.5 text-xs text-gray-500">Type at least 2 letters, then pick from the list</p>
          ) : last ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Last time ({formatDate(last.date)}):</span>
              <span className="tabular font-medium text-gray-700">
                {lastWorking.filter((s) => !s.is_warmup).map((s) => `${fmt(s.weight)}×${s.reps}`).join(', ') || '—'}
              </span>
              {allEmpty && lastWorking.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUseLast(last.sets)}
                  disabled={disabled}
                  className="font-semibold text-primary-600 hover:text-primary-700"
                >
                  Use these
                </button>
              )}
            </p>
          ) : last === null ? (
            <p className="mt-1.5 text-xs text-gray-500">First time logging this exercise</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={Trash2}
          onClick={onRemove}
          disabled={disabled}
          className="mt-1 !text-gray-400 hover:!bg-danger-50 hover:!text-danger-600"
          aria-label={`Remove ${exercise.exerciseName || 'exercise'}`}
          title="Remove exercise"
        />
      </div>

      {exercise.sets.length > 0 && (
        <div className="mb-3">
          <SetRowHeader units={units} trackCompletion={trackCompletion} />
          <div className="space-y-0.5">
            {exercise.sets.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                units={units}
                previous={lastWorking[i]}
                trackCompletion={trackCompletion}
                onChange={(field, value) => onSetChange(set.id, field, value)}
                onRemove={() => onRemoveSet(set.id)}
                onToggleDone={() => onToggleDone(set.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="soft" size="sm" icon={Plus} onClick={onAddSet} disabled={disabled}>
          Add set
        </Button>
        {extraActions}
        <span className="ml-auto text-xs font-medium text-gray-400">
          {trackCompletion ? `${doneCount}/${exercise.sets.length} done` : `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`}
        </span>
      </div>
    </Card>
  );
}

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
 * - onChange(values): called after every edit with { name, date, notes, exercises }
 *   (Active Workout saves its draft from this).
 * - submitLabel / savingLabel: text for the primary button.
 * - namePlaceholder: placeholder for the workout name.
 * - trackCompletion: show a "done" check on each set (Active Workout).
 * - onSetCompleted(): called when a set is checked off (starts the rest timer).
 * - excludeWorkoutId: workout to ignore for "last time" hints (Edit Workout).
 * - renderExerciseActions(exercise, { disabled }): extra buttons next to "Add set".
 * - ref: exposes { submit() } so a page header can trigger saving.
 */
function WorkoutEditor({
  initialValues,
  onSubmit,
  onCancel,
  onChange,
  submitLabel = 'Save workout',
  savingLabel = 'Saving...',
  namePlaceholder = 'e.g., Upper Strength',
  trackCompletion = false,
  onSetCompleted,
  excludeWorkoutId,
  renderExerciseActions,
  ref
}) {
  // Fresh "last time" data for each editing session
  useState(clearLastPerformanceCache);

  const { user } = useAuth();
  const units = user?.units || 'lbs';

  const [name, setName] = useState(initialValues.name ?? '');
  const [date, setDate] = useState(initialValues.date ?? '');
  const [notes, setNotes] = useState(initialValues.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(initialValues.notes));
  const [exercises, setExercises] = useState(initialValues.exercises ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef(null);

  // Report edits (skip the initial render)
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChangeRef.current?.({ name, date, notes, exercises });
  }, [name, date, notes, exercises]);

  const updateExercise = (exerciseId, update) => {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? update(ex) : ex)));
  };

  const handleAddExercise = () => setExercises((prev) => [...prev, emptyExercise()]);

  const handleSelectExercise = (exerciseId, suggestion) => {
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      exerciseId: suggestion.id,
      exerciseName: suggestion.name,
      sets: ex.sets.length > 0 ? ex.sets : [emptySet(1)]
    }));
  };

  const handleAddSet = (exerciseId) => {
    updateExercise(exerciseId, (ex) => {
      const previous = [...ex.sets].reverse().find((s) => !s.isWarmup) ?? ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, emptySet(ex.sets.length + 1, previous)] };
    });
  };

  const handleRemoveSet = (exerciseId, setId) => {
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
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

  const handleToggleDone = (exerciseId, setId) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const set = exercise?.sets.find((s) => s.id === setId);
    if (!set) return;
    const nowDone = !set.done;
    updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.id === setId ? { ...s, done: nowDone } : s))
    }));
    if (nowDone) onSetCompleted?.(set);
  };

  const handleUseLast = (exerciseId, lastSets) => {
    updateExercise(exerciseId, (ex) => ({ ...ex, sets: setsFromLastPerformance(lastSets) }));
  };

  const handleSubmit = async () => {
    setError('');
    const validationError = validateWorkout({ name, exercises });
    if (validationError) {
      setError(validationError);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
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

  useImperativeHandle(ref, () => ({ submit: handleSubmit, isSaving }));

  return (
    <div className="space-y-4">
      {error && (
        <div ref={errorRef}>
          <Alert onDismiss={() => setError('')}>{error}</Alert>
        </div>
      )}

      <Card padding="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="workout-name" className="eyebrow mb-1.5 block">Workout name</label>
            <Input
              id="workout-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              disabled={isSaving}
              className="!text-base font-semibold"
            />
          </div>
          <div className="sm:w-44">
            <label htmlFor="workout-date" className="eyebrow mb-1.5 block">Date</label>
            <Input id="workout-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} />
          </div>
        </div>
      </Card>

      {exercises.map((exercise, index) => (
        <ExerciseBlock
          key={exercise.id}
          index={index}
          exercise={exercise}
          units={units}
          disabled={isSaving}
          trackCompletion={trackCompletion}
          excludeWorkoutId={excludeWorkoutId}
          onNameChange={(value) => updateExercise(exercise.id, (ex) => ({ ...ex, exerciseName: value, exerciseId: null }))}
          onSelect={(suggestion) => handleSelectExercise(exercise.id, suggestion)}
          onRemove={() => setExercises((prev) => prev.filter((ex) => ex.id !== exercise.id))}
          onAddSet={() => handleAddSet(exercise.id)}
          onRemoveSet={(setId) => handleRemoveSet(exercise.id, setId)}
          onSetChange={(setId, field, value) => handleSetChange(exercise.id, setId, field, value)}
          onToggleDone={(setId) => handleToggleDone(exercise.id, setId)}
          onUseLast={(lastSets) => handleUseLast(exercise.id, lastSets)}
          extraActions={renderExerciseActions?.(exercise, { disabled: isSaving })}
        />
      ))}

      <button
        type="button"
        onClick={handleAddExercise}
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm font-semibold text-gray-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Add exercise
      </button>

      {showNotes ? (
        <Card padding="p-4 sm:p-5">
          <label htmlFor="workout-notes" className="eyebrow mb-1.5 block">Notes</label>
          <Textarea
            id="workout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did the workout feel? Any observations?"
            rows={3}
            className="resize-y"
            disabled={isSaving}
          />
        </Card>
      ) : (
        <Button variant="ghost" size="sm" icon={StickyNote} onClick={() => setShowNotes(true)}>
          Add notes
        </Button>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="lg" className="sm:min-w-48" onClick={handleSubmit} loading={isSaving} loadingText={savingLabel}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default WorkoutEditor;
