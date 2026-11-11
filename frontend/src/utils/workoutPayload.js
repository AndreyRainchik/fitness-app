/**
 * Helpers for turning workout-editor state into the bulk `sets` payload
 * accepted by POST /api/workouts and PUT /api/workouts/:id.
 *
 * Editor state shape (shared by NewWorkout, ActiveWorkout and EditWorkout):
 *   exercises: [{ exerciseId, exerciseName, sets: [{ setNumber, weight, reps, rpe, isWarmup, existingSetId? }] }]
 */

/**
 * Returns an error message if any exercise was typed but never matched to a
 * known exercise (no exerciseId), otherwise null.
 */
export function findUnmatchedExercise(exercises) {
  const unmatched = exercises.find(ex => !ex.exerciseId);
  if (!unmatched) return null;
  return `Select "${unmatched.exerciseName.trim()}" from the exercise suggestions before saving`;
}

/**
 * Flatten editor exercises into the API's sets array.
 * Existing sets (EditWorkout) keep their id so they are updated in place.
 */
export function buildSetsPayload(exercises) {
  return exercises.flatMap(exercise =>
    exercise.sets.map(set => {
      const rpe = set.rpe === '' || set.rpe === null || set.rpe === undefined
        ? null
        : parseFloat(set.rpe);
      return {
        ...(set.existingSetId ? { id: set.existingSetId } : {}),
        exercise_id: exercise.exerciseId,
        set_number: set.setNumber,
        weight: parseFloat(set.weight) || 0,
        reps: parseInt(set.reps) || 0,
        rpe: Number.isNaN(rpe) ? null : rpe,
        is_warmup: Boolean(set.isWarmup)
      };
    })
  );
}
