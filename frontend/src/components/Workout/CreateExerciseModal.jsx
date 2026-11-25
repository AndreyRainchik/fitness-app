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
  'Back', 'Biceps', 'Calves', 'Chest', 'Core', 'Forearms', 'Glutes', 'Hamstrings', 'Quadriceps', 'Shoulders', 'Triceps',
];

const mergeGroups = (groups) => [...new Set([...STANDARD_MUSCLE_GROUPS, ...groups])].sort((a, b) => a.localeCompare(b));

// "hip thrust" -> "Hip Thrust"; names typed with capitals are left alone
const suggestName = (typed) => {
  const name = typed.trim();
  return name === name.toLowerCase() ? name.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : name;
};

/**
 * Add an exercise that isn't in the library. It's private to this user.
 * Calls onCreated(exercise) with the new exercise, or with the existing one
 * when the user already has an exercise by that name.
 */
function CreateExerciseModal({ open, initialName = '', onClose, onCreated }) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('barbell');
  const [muscle, setMuscle] = useState('');
  const [muscleGroups, setMuscleGroups] = useState(STANDARD_MUSCLE_GROUPS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(suggestName(initialName));
    setError('');
    exercisesAPI.getMuscleGroups()
      .then((res) => {
        if (res?.muscle_groups?.length) setMuscleGroups(mergeGroups(res.muscle_groups));
      })
      .catch(() => { /* keep the standard list */ });
  }, [open, initialName]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Enter a name (at least 2 letters)');
    if (!muscle) return setError('Choose the main muscle group it works');

    setSaving(true);
    try {
      const res = await exercisesAPI.create({ name: name.trim(), category, primary_muscle_group: muscle });
      onCreated(res.exercise);
    } catch (err) {
      // Already have one by that name: use it
      if (err.status === 409 && err.data?.exercise) {
        onCreated(err.data.exercise);
      } else {
        setError(err.message || 'Could not add the exercise');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New exercise"
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="create-exercise-form" disabled={saving}>
            {saving ? 'Adding…' : 'Add exercise'}
          </Button>
        </>
      )}
    >
      <form id="create-exercise-form" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Equipment">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Main muscle group" hint="Used for weekly volume per muscle group">
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="">Choose…</option>
            {muscleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-gray-500">Only you can see exercises you add.</p>
      </form>
    </Modal>
  );
}

export default CreateExerciseModal;
