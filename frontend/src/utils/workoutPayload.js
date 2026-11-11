/**
 * Helpers for turning workout-editor state into the bulk `sets` payload
 * accepted by POST /api/workouts and PUT /api/workouts/:id.
 *
 * Editor state shape (shared by NewWorkout, ActiveWorkout and EditWorkout):
 *   exercises: [{ exerciseId, exerciseName, sets: [{ setNumber, weight, reps, rpe, isWarmup, existingSetId? }] }]
 */

let localIdCounter = 0;

/**
 * Unique id for editor-only rows (exercise blocks and new sets). Never sent to
 * the API; existing sets carry their database id in existingSetId instead.
 */
export function newLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

/** A blank set row for the editor. */
export function emptySet(setNumber) {
  return { id: newLocalId(), setNumber, weight: '', reps: '', rpe: '', isWarmup: false };
}

/** A blank exercise block for the editor. */
export function emptyExercise() {
  return { id: newLocalId(), exerciseId: null, exerciseName: '', sets: [] };
}

/**
 * Group API sets (from a workout, a template, or a program day) into blocks,
 * one per exercise, in the order they were saved. Sets inside a block are
 * the original API objects, sorted by set number.
 *
 * A new block starts when the exercise changes or when the set number resets
 * for the same exercise (e.g. 5/3/1 main sets followed by BBB sets).
 *
 * Returns [{ exercise_id, exercise_name, sets }].
 */
export function groupSetsByExercise(sets = []) {
  const sortedSets = [...sets].sort((a, b) => a.id - b.id);
  const groups = [];
  let current = null;
  let lastSetNumber = 0;

  for (const set of sortedSets) {
    const setNumberReset = current
      && current.exercise_id === set.exercise_id
      && set.set_number <= lastSetNumber;

    if (!current || current.exercise_id !== set.exercise_id || setNumberReset) {
      current = { exercise_id: set.exercise_id, exercise_name: set.exercise_name, sets: [] };
      groups.push(current);
      lastSetNumber = 0;
    }
    current.sets.push(set);
    lastSetNumber = set.set_number;
  }

  for (const group of groups) {
    group.sets.sort((a, b) => a.set_number - b.set_number);
  }
  return groups;
}

/**
 * Same grouping as groupSetsByExercise, converted to the editor's shape.
 *
 * keepIds: true when editing a saved workout, so each set keeps its database
 * id (existingSetId) and is updated in place instead of re-created.
 */
export function setsToExerciseBlocks(sets = [], { keepIds = false } = {}) {
  return groupSetsByExercise(sets).map((group) => ({
    id: newLocalId(),
    exerciseId: group.exercise_id,
    exerciseName: group.exercise_name,
    sets: group.sets.map((set) => ({
      id: newLocalId(),
      ...(keepIds ? { existingSetId: set.id } : {}),
      setNumber: set.set_number,
      weight: String(set.weight ?? ''),
      reps: String(set.reps ?? ''),
      rpe: set.rpe === null || set.rpe === undefined ? '' : String(set.rpe),
      isWarmup: set.is_warmup === 1 || set.is_warmup === true
    }))
  }));
}

/**
 * Returns the first validation error for the editor state, or null.
 */
export function validateWorkout({ name, exercises }) {
  if (!name.trim()) return 'Please enter a workout name';
  if (exercises.length === 0) return 'Please add at least one exercise';
  if (exercises.some(ex => !ex.exerciseName.trim())) return 'Please enter names for all exercises';
  if (exercises.some(ex => ex.sets.length === 0)) return 'Each exercise must have at least one set';
  return findUnmatchedExercise(exercises);
}

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
