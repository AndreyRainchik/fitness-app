/**
 * Turns Hevy workouts into this app's workouts and sets, and suggests which
 * of this app's exercises a Hevy exercise is.
 *
 * Pure functions (no database or network) so they can be tested directly.
 */

const KG_TO_LBS = 2.2046226218;

// ---------------------------------------------------------------------------
// Exercise matching
// ---------------------------------------------------------------------------

/**
 * Lowercase, letters and digits only, trailing plural "s" dropped from each
 * word: "Triceps Pushdown" and "Tricep Pushdown" both become "triceppushdown";
 * "Pull Up" and "Pull-up" both become "pullup".
 */
export function normalizeExerciseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .join('');
}

// Hevy names (normalized) whose closest built-in exercise has a different name
const NAME_ALIASES = {
  barbellbentoverrow: 'barbellrow',
  bentoverrowbarbell: 'barbellrow',
  barbellbicepcurl: 'barbellcurl',
  dumbbellbicepcurl: 'dumbbellcurl',
  barbellinclinebenchpress: 'inclinebarbellbenchpress',
  dumbbellinclinebenchpress: 'inclinedumbbellpress',
  dumbbellshoulderpress: 'dumbbelloverheadpress',
  barbellshoulderpress: 'barbelloverheadpress',
  barbellstandingcalfraise: 'barbellcalfraise',
  machinelyinglegcurl: 'legcurl',
  machineseatedlegcurl: 'legcurl',
  assistedpullup: 'machineassistedpullup',
  machineassistedpullup: 'machineassistedpullup',
  dumbbelllunge: 'lunge',
  dumbbellgobletsquat: 'gobletsquat',
  kettlebellgobletsquat: 'gobletsquat',
  cablefacepull: 'facepull',
  cablelatpulldown: 'latpulldown',
  cableseatedrow: 'cablerow',
};

/**
 * Split "Bench Press (Barbell)" into { base: 'Bench Press', equipment: 'Barbell' }.
 */
export function splitHevyTitle(title) {
  const match = String(title || '').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return match ? { base: match[1], equipment: match[2] } : { base: String(title || ''), equipment: null };
}

/** Normalized names to look for, best first. */
function candidateNames(hevyTitle) {
  const { base, equipment } = splitHevyTitle(hevyTitle);
  const names = [hevyTitle];
  if (equipment) names.push(`${equipment} ${base}`, `${base} ${equipment}`);
  names.push(base);

  const normalized = [];
  for (const name of names) {
    const n = normalizeExerciseName(name);
    if (!n) continue;
    normalized.push(n);
    if (NAME_ALIASES[n]) normalized.push(NAME_ALIASES[n]);
  }
  return [...new Set(normalized)];
}

/**
 * Builds a function that suggests an existing exercise for a Hevy exercise
 * title, or returns null when nothing matches well enough.
 */
export function createExerciseMatcher(exercises) {
  const byName = new Map();
  for (const exercise of exercises) {
    const key = normalizeExerciseName(exercise.name);
    if (key && !byName.has(key)) byName.set(key, exercise);
  }
  return (hevyTitle) => {
    for (const candidate of candidateNames(hevyTitle)) {
      const exercise = byName.get(candidate);
      if (exercise) return exercise;
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// New exercises from Hevy exercise templates
// ---------------------------------------------------------------------------

// Hevy muscle groups -> this app's muscle groups (the ones the body map knows)
const MUSCLE_GROUPS = {
  abdominals: 'Core',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quadriceps: 'Quadriceps',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  glutes: 'Glutes',
  abductors: 'Glutes',
  adductors: 'Quadriceps',
  lats: 'Back',
  upper_back: 'Back',
  traps: 'Back',
  lower_back: 'Back',
  chest: 'Chest',
  full_body: 'Core',
  neck: 'Shoulders',
};

/** This app's muscle group for a Hevy one ('Other' when there is no good fit). */
export function mapHevyMuscleGroup(hevyMuscleGroup) {
  return MUSCLE_GROUPS[hevyMuscleGroup] ?? 'Other';
}

/** This app's exercise category for a Hevy exercise template. */
export function mapHevyCategory(template) {
  const { equipment } = splitHevyTitle(template?.title);
  if (equipment && /cable/i.test(equipment)) return 'cable';
  switch (template?.equipment) {
    case 'barbell': return 'barbell';
    case 'dumbbell': return 'dumbbell';
    case 'machine': return 'machine';
    case 'none': return 'bodyweight';
    default: return 'other';
  }
}

/**
 * Suggested fields for creating an exercise from a Hevy exercise template
 * (template may be null when Hevy didn't return one).
 */
export function newExerciseFromTemplate(hevyTitle, template) {
  const primary = mapHevyMuscleGroup(template?.primary_muscle_group);
  const secondary = [...new Set((template?.secondary_muscle_groups || []).map(mapHevyMuscleGroup))]
    .filter((group) => group !== 'Other' && group !== primary);
  return {
    name: hevyTitle,
    category: template ? mapHevyCategory(template) : 'other',
    primary_muscle_group: primary,
    secondary_muscle_groups: secondary,
    is_compound: secondary.length >= 2 ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Workout conversion
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' of an ISO timestamp in an IANA timezone (UTC if it's invalid). */
export function localDate(isoTimestamp, timeZone) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return null;
  const format = (tz) => new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  try {
    return format(timeZone || 'UTC');
  } catch {
    return format('UTC');
  }
}

/** Hevy weights are always kilograms. */
export function convertWeight(weightKg, units) {
  const kg = Number(weightKg) || 0;
  if (units === 'lbs') return Math.round(kg * KG_TO_LBS * 10) / 10;
  return Math.round(kg * 100) / 100;
}

function formatDuration(seconds) {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

function setNotes(hevySet) {
  const notes = [];
  if (hevySet.type === 'dropset') notes.push('Drop set');
  if (hevySet.type === 'failure') notes.push('To failure');
  if (hevySet.duration_seconds) notes.push(`Duration ${formatDuration(hevySet.duration_seconds)}`);
  if (hevySet.distance_meters) notes.push(`Distance ${hevySet.distance_meters} m`);
  return notes;
}

const byIndex = (a, b) => (a.index ?? 0) - (b.index ?? 0);

/**
 * Unique exercise templates used in the given Hevy workouts, in first-seen
 * order: [{ template_id, title, workout_count, set_count }].
 */
export function collectExerciseTemplates(hevyWorkouts) {
  const templates = new Map();
  for (const workout of hevyWorkouts) {
    const seenInWorkout = new Set();
    for (const exercise of [...(workout.exercises || [])].sort(byIndex)) {
      const id = exercise.exercise_template_id;
      if (!id) continue;
      if (!templates.has(id)) templates.set(id, { template_id: id, title: exercise.title, workout_count: 0, set_count: 0 });
      const entry = templates.get(id);
      entry.set_count += (exercise.sets || []).length;
      if (!seenInWorkout.has(id)) {
        entry.workout_count += 1;
        seenInWorkout.add(id);
      }
    }
  }
  return [...templates.values()];
}

/**
 * Convert one Hevy workout.
 *
 *   exerciseFor(templateId) -> this app's exercise ({ id, name }), or null to leave it out
 *   units: the user's weight unit ('kg' | 'lbs')
 *   timeZone: IANA timezone used to pick the workout's date
 *
 * Returns { workout: { date, name, notes, duration_minutes, start_time }, sets, skipped_exercises }.
 * Sets are numbered from 1 within each Hevy exercise, in Hevy's order.
 * RPE is copied when Hevy has it and left empty otherwise.
 */
export function convertHevyWorkout(hevyWorkout, { exerciseFor, units, timeZone }) {
  const start = new Date(hevyWorkout.start_time);
  const end = new Date(hevyWorkout.end_time);
  const minutes = Math.round((end - start) / 60000);

  const sets = [];
  const skipped = [];

  for (const hevyExercise of [...(hevyWorkout.exercises || [])].sort(byIndex)) {
    const exercise = exerciseFor(hevyExercise.exercise_template_id);
    if (!exercise) {
      skipped.push(hevyExercise.title);
      continue;
    }
    const assisted = /assisted/i.test(exercise.name);
    const exerciseNote = hevyExercise.notes?.trim();

    [...(hevyExercise.sets || [])].sort(byIndex).forEach((hevySet, i) => {
      let weight = convertWeight(hevySet.weight_kg, units);
      // This app records machine assistance as a negative weight
      if (assisted && weight > 0) weight = -weight;

      const notes = setNotes(hevySet);
      if (i === 0 && exerciseNote) notes.unshift(exerciseNote);

      const rpe = hevySet.rpe === null || hevySet.rpe === undefined ? null : Number(hevySet.rpe);

      sets.push({
        exercise_id: exercise.id,
        set_number: i + 1,
        reps: Math.max(0, Math.round(Number(hevySet.reps) || 0)),
        weight,
        rpe: Number.isFinite(rpe) && rpe >= 0 && rpe <= 10 ? rpe : null,
        is_warmup: hevySet.type === 'warmup',
        notes: notes.length ? notes.join(' · ') : null,
      });
    });
  }

  return {
    workout: {
      date: localDate(hevyWorkout.start_time, timeZone),
      name: hevyWorkout.title?.trim() || 'Hevy workout',
      notes: hevyWorkout.description?.trim() || null,
      duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
      start_time: Number.isNaN(start.getTime()) ? null : start.toISOString(),
    },
    sets,
    skipped_exercises: skipped,
  };
}

/** Short summary of a Hevy workout for the import list. */
export function summarizeHevyWorkout(hevyWorkout) {
  const exercises = [...(hevyWorkout.exercises || [])].sort(byIndex);
  const start = new Date(hevyWorkout.start_time);
  const end = new Date(hevyWorkout.end_time);
  const minutes = Math.round((end - start) / 60000);
  return {
    id: hevyWorkout.id,
    title: hevyWorkout.title || 'Hevy workout',
    start_time: hevyWorkout.start_time,
    end_time: hevyWorkout.end_time,
    updated_at: hevyWorkout.updated_at,
    duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    exercises: exercises.map((e) => ({ title: e.title, set_count: (e.sets || []).length })),
    set_count: exercises.reduce((n, e) => n + (e.sets || []).length, 0),
  };
}
