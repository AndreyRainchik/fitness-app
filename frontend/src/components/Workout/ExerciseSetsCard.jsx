import React from 'react';
import { Trophy } from 'lucide-react';
import { Badge, Card } from '../ui';
import { formatCompact, formatNumber } from '../../utils/format';

/**
 * Read-only list of one exercise's sets (Workout Detail, Template Detail).
 * `group` is an item from groupSetsByExercise(). Sets may carry
 * isVolumePR / is1RMPR flags from /workouts/:id/with-prs.
 */
export function ExerciseSetsCard({ group, units }) {
  const subtotal = group.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <h2 className="min-w-0 truncate font-semibold tracking-tight text-gray-900 sm:text-lg">{group.exercise_name}</h2>
        <span className="tabular flex-shrink-0 text-xs text-gray-500">{formatNumber(subtotal)} {units}</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {group.sets.map((set) => {
          const warmup = set.is_warmup === 1 || set.is_warmup === true;
          const hasPR = set.isVolumePR || set.is1RMPR;
          return (
            <li key={set.id} className={`flex items-center gap-3 px-4 py-2.5 sm:px-5 ${hasPR ? 'bg-warning-50/60' : ''}`}>
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  warmup ? 'bg-warning-100 text-warning-700' : 'bg-gray-100 text-gray-600'
                }`}
                title={warmup ? 'Warm-up' : `Set ${set.set_number}`}
              >
                {warmup ? 'W' : set.set_number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="tabular block text-[15px] font-semibold text-gray-900">
                  {formatNumber(set.weight, 2)} <span className="text-xs font-medium text-gray-500">{units}</span> × {set.reps}
                </span>
                <span className="tabular block text-xs text-gray-500">
                  {/* RPE only shows when one was logged */}
                  {[
                    set.rpe != null && !warmup ? `RPE ${set.rpe}` : null,
                    `${formatNumber(set.weight * set.reps)} ${units}`,
                    set.notes || null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              {hasPR && (
                <span className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                  {set.is1RMPR && <Badge tone="warning" icon={Trophy}>1RM</Badge>}
                  {set.isVolumePR && <Badge tone="warning" icon={Trophy}>Volume</Badge>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Three compact stat boxes in one row (fits a 320px phone). */
export function WorkoutStats({ volume, exercises, sets, units }) {
  const items = [
    // Full number while it fits the box ("4,898 kg"); shortened past that ("112k")
    { label: 'Volume', value: Number(volume) < 100_000 ? formatNumber(volume) : formatCompact(volume), unit: units },
    { label: 'Exercises', value: exercises },
    { label: 'Sets', value: sets },
  ];
  return (
    <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
      {items.map((s) => (
        <Card key={s.label} padding="px-3 py-3 sm:p-5">
          <p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{s.label}</p>
          <p className="tabular mt-1 truncate text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            {s.value}
            {s.unit && <>{' '}<span className="text-xs font-medium text-gray-500">{s.unit}</span></>}
          </p>
        </Card>
      ))}
    </div>
  );
}
