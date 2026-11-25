import React, { useCallback, useEffect, useState } from 'react';
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import { exercisesAPI } from '../../services/api';
import ExerciseFormModal from '../Workout/ExerciseFormModal';
import { Button, Card, CardHeader, EmptyState, LoadingState, useConfirm, useToast } from '../ui';

const EQUIPMENT = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight', other: 'Other',
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 sets · 1 template", or null when nothing uses it. */
function usageText(usage = {}) {
  const parts = [];
  if (usage.sets) parts.push(plural(usage.sets, 'set'));
  if (usage.templates) parts.push(plural(usage.templates, 'template'));
  if (usage.programs) parts.push(plural(usage.programs, 'program'));
  return parts.length ? parts.join(' · ') : null;
}

const inUse = (usage = {}) => Boolean(usage.sets || usage.templates || usage.programs);

/**
 * The exercises the user added (in the workout editor or from a Hevy
 * import): change their name, equipment and muscle groups, or delete ones
 * nothing uses. Built-in exercises aren't listed; they can't be changed.
 */
function MyExercises() {
  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState('');
  // undefined: closed; null: adding; an exercise: editing it
  const [editing, setEditing] = useState(undefined);
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await exercisesAPI.getMine();
      setExercises(res.exercises || []);
    } catch (err) {
      setError(err.message || 'Could not load your exercises');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (saved) => {
    const adding = editing === null;
    setEditing(undefined);
    toast({ tone: 'success', message: adding ? `Added “${saved.name}”` : `Saved “${saved.name}”` });
    load();
  };

  const handleDelete = async (exercise) => {
    const ok = await confirm({
      title: `Delete “${exercise.name}”?`,
      message: 'It isn’t used in any workout, template or program. This can’t be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await exercisesAPI.remove(exercise.id);
      toast({ tone: 'success', message: `Deleted “${exercise.name}”` });
      load();
    } catch (err) {
      toast({ tone: 'error', message: err.message || 'Could not delete the exercise' });
      load();
    }
  };

  let body;
  if (error) {
    body = (
      <EmptyState tone="error" title="Couldn't load your exercises" description={error} action={<Button onClick={load}>Try again</Button>} />
    );
  } else if (!exercises) {
    body = <LoadingState label="Loading your exercises..." />;
  } else if (exercises.length === 0) {
    body = (
      <EmptyState
        icon={Dumbbell}
        title="No exercises of your own yet"
        description="When an exercise isn't in the library, add it here or straight from a workout. Only you see them."
        action={<Button icon={Plus} onClick={() => setEditing(null)}>Add exercise</Button>}
      />
    );
  } else {
    body = (
      <Card>
        <CardHeader
          title="My exercises"
          subtitle="Exercises you added. Changes show everywhere they're used."
          action={<Button size="sm" icon={Plus} onClick={() => setEditing(null)}>Add</Button>}
        />
        <ul className="divide-y divide-gray-200/80">
          {exercises.map((exercise) => {
            const used = usageText(exercise.usage);
            const secondary = exercise.secondary_muscle_groups || [];
            return (
              <li key={exercise.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{exercise.name}</p>
                  <p className="text-sm text-gray-500">
                    {EQUIPMENT[exercise.category] ?? exercise.category} · {exercise.primary_muscle_group}
                    {secondary.length > 0 && <span className="text-gray-400"> (+ {secondary.join(', ')})</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{used ? `Used in ${used}` : 'Not used yet'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(exercise)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label={`Edit ${exercise.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(exercise)}
                    disabled={inUse(exercise.usage)}
                    title={inUse(exercise.usage) ? 'In use, so it can’t be deleted' : undefined}
                    className="rounded-lg p-2 text-gray-500 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                    aria-label={`Delete ${exercise.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return (
    <>
      {body}
      <ExerciseFormModal
        open={editing !== undefined}
        exercise={editing || null}
        onClose={() => setEditing(undefined)}
        onSaved={handleSaved}
      />
    </>
  );
}

export default MyExercises;
