import React, { useEffect, useState } from 'react';
import { exercisesAPI } from '../../services/api';
import { Alert, Button, Field, Input, Modal, Select } from '../ui';

const CATEGORIES = [
  ['barbell', 'Barbell'],
  ['dumbbell', 'Dumbbell'],
  ['machine', 'Machine'],
  ['cable', 'Cable'],
  ['bodyweight', 'Bodyweight'],
  ['other', 'Other'],
];

// Always offered, plus any other group the library uses (the library only
// reports groups some exercise has as its main one, so e.g. Glutes is missing)
const STANDARD_MUSCLE_GROUPS = [
  'Biceps', 'Calves', 'Chest', 'Core', 'Forearms', 'Glutes', 'Hamstrings', 'Lower Back', 'Quadriceps', 'Shoulders', 'Triceps', 'Upper Back',
];

const mergeGroups = (...lists) => [...new Set([...STANDARD_MUSCLE_GROUPS, ...lists.flat()])]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

// "hip thrust" -> "Hip Thrust"; names typed with capitals are left alone
const suggestName = (typed) => {
  const name = typed.trim();
  return name === name.toLowerCase() ? name.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : name;
};

/**
 * Add an exercise that isn't in the library, or change one of the user's
 * own (pass `exercise`). Own exercises are private to the user.
 *
 * Adding calls onSaved(exercise) with the new exercise, or with the existing
 * one when the user already has an exercise by that name. Editing calls
 * onSaved(updatedExercise).
 */
function ExerciseFormModal({ open, exercise = null, initialName = '', onClose, onSaved }) {
  const editing = Boolean(exercise);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('barbell');
  const [muscle, setMuscle] = useState('');
  const [secondary, setSecondary] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState(STANDARD_MUSCLE_GROUPS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (exercise) {
      setName(exercise.name);
      setCategory(exercise.category || 'other');
      setMuscle(exercise.primary_muscle_group || '');
      setSecondary(Array.isArray(exercise.secondary_muscle_groups) ? exercise.secondary_muscle_groups : []);
    } else {
      setName(suggestName(initialName));
      setCategory('barbell');
      setMuscle('');
      setSecondary([]);
    }
    exercisesAPI.getMuscleGroups()
      .then((res) => setMuscleGroups(mergeGroups(res?.muscle_groups ?? [])))
      .catch(() => { /* keep the standard list */ });
  }, [open, exercise, initialName]);

  // An exercise may carry a group that isn't in the list (e.g. 'Other' from Hevy)
  const groups = mergeGroups(muscleGroups, muscle, secondary);

  const toggleSecondary = (group) => {
    setSecondary((current) => (current.includes(group) ? current.filter((g) => g !== group) : [...current, group]));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Enter a name (at least 2 letters)');
    if (!muscle) return setError('Choose the main muscle group it works');

    const fields = {
      name: name.trim(),
      category,
      primary_muscle_group: muscle,
      secondary_muscle_groups: secondary.filter((g) => g !== muscle),
    };
    setSaving(true);
    try {
      const res = editing
        ? await exercisesAPI.update(exercise.id, fields)
        : await exercisesAPI.create(fields);
      onSaved(res.exercise);
    } catch (err) {
      // Adding one they already have: use it
      if (!editing && err.status === 409 && err.data?.exercise) {
        onSaved(err.data.exercise);
      } else {
        setError(err.message || 'Could not save the exercise');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit exercise' : 'New exercise'}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="exercise-form" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add exercise'}
          </Button>
        </>
      )}
    >
      <form id="exercise-form" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Equipment">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Main muscle group" hint="Each set counts once here in weekly volume">
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="">Choose…</option>
            {groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-gray-700">Also works <span className="font-normal text-gray-500">(optional)</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {groups.filter((g) => g !== muscle).map((group) => {
              const on = secondary.includes(group);
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSecondary(group)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    on
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Each set counts half for these.</p>
        </fieldset>
        {!editing && <p className="text-xs text-gray-500">Only you can see exercises you add.</p>}
      </form>
    </Modal>
  );
}

export default ExerciseFormModal;
