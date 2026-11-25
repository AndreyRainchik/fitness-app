import { body } from 'express-validator';
import { Exercise } from '../models/index.js';

/**
 * Returns true when the exercise supports negative weights (i.e. machine
 * assistance is recorded as a negative number rather than an absolute stack
 * weight).  Exercises whose name contains the word "assisted" (case-
 * insensitive) are treated as assisted.
 */
export function isAssistedExercise(exercise) {
  return exercise && exercise.name.toLowerCase().includes('assisted');
}

// Validation rules for an optional `sets` array in workout and template create/update bodies
export const bulkSetValidators = [
  body('sets').optional().isArray().withMessage('sets must be an array'),
  body('sets.*.id').optional({ nullable: true }).isInt(),
  body('sets.*.exercise_id').isInt().withMessage('Each set needs an exercise_id'),
  body('sets.*.set_number').isInt({ min: 1 }).withMessage('Set number must be positive'),
  body('sets.*.reps').isInt({ min: 0 }).withMessage('Reps must be positive'),
  body('sets.*.weight').isFloat().withMessage('Weight must be a number'),
  body('sets.*.rpe').optional({ nullable: true }).isFloat({ min: 0, max: 10 }),
  body('sets.*.is_warmup').optional().isBoolean(),
  body('sets.*.notes').optional({ nullable: true }).isString()
];

/**
 * Normalize and check a bulk `sets` array. Returns { sets } or { error }.
 * Unknown exercises and negative weights on non-assisted exercises are rejected.
 */
export function prepareBulkSets(rawSets, userId) {
  const exercises = new Map();
  const sets = [];

  for (const raw of rawSets) {
    const exerciseId = Number(raw.exercise_id);
    if (!exercises.has(exerciseId)) {
      // The built-in library or one of this user's own exercises
      exercises.set(exerciseId, Exercise.findVisible(exerciseId, userId));
    }
    const exercise = exercises.get(exerciseId);
    if (!exercise) {
      return { error: `Exercise ${exerciseId} not found` };
    }

    const weight = Number(raw.weight);
    if (weight < 0 && !isAssistedExercise(exercise)) {
      return { error: `Weight must be positive for ${exercise.name}` };
    }

    sets.push({
      id: raw.id ? Number(raw.id) : null,
      exercise_id: exerciseId,
      set_number: Number(raw.set_number),
      reps: Number(raw.reps),
      weight,
      rpe: raw.rpe === undefined || raw.rpe === null || raw.rpe === '' ? null : Number(raw.rpe),
      is_warmup: raw.is_warmup === true || raw.is_warmup === 1 || raw.is_warmup === 'true',
      notes: raw.notes || null
    });
  }

  return { sets };
}
