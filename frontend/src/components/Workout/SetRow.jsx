import React from 'react';
import { Check, X } from 'lucide-react';

// 0–10 in half steps (Hevy logs RPE like 8.5). RPE is optional: '–' leaves it empty.
const RPE_OPTIONS = Array.from({ length: 21 }, (_, i) => i / 2);

/**
 * Column layout shared by SetRow and SetRowHeader:
 * set # | previous (sm+) | weight | reps | RPE | done (optional) | remove
 */
const setGridClass = (trackCompletion) =>
  `grid items-center gap-1 sm:gap-2 ${
    trackCompletion
      ? 'grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem_2.25rem_1.75rem] sm:grid-cols-[2.25rem_5.5rem_minmax(0,1fr)_minmax(0,1fr)_4rem_2.5rem_2rem]'
      : 'grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_1.75rem] sm:grid-cols-[2.25rem_5.5rem_minmax(0,1fr)_minmax(0,1fr)_4rem_2rem]'
  }`;

export function SetRowHeader({ units, trackCompletion }) {
  return (
    <div className={`${setGridClass(trackCompletion)} mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400`}>
      <span className="text-center">Set</span>
      <span className="hidden sm:block">Previous</span>
      <span className="text-center">{units}</span>
      <span className="text-center">Reps</span>
      <span className="text-center">RPE</span>
      {trackCompletion && <span className="text-center"><Check className="mx-auto h-3.5 w-3.5" aria-label="Done" /></span>}
      <span />
    </div>
  );
}

const fmt = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

/**
 * One set in the workout editor.
 *
 * - Tapping the set number toggles warm-up ("W").
 * - `previous` is the matching set from last time; it shows in its own
 *   column on wider screens and as the input placeholders on phones.
 * - With `trackCompletion`, a check button marks the set done (onToggleDone).
 *
 * onChange(field, value) with field in 'weight' | 'reps' | 'rpe' | 'isWarmup'.
 */
function SetRow({ set, units, previous, onChange, onRemove, onToggleDone, trackCompletion = false, disabled = false }) {
  const rpeDisabled = set.isWarmup || disabled;
  const done = trackCompletion && set.done;
  const input = `h-10 w-full px-0.5 text-center text-[15px] font-semibold tabular ${done ? '!border-success-200 !bg-success-50' : ''}`;

  return (
    <div
      className={`${setGridClass(trackCompletion)} rounded-xl px-1 py-1 transition-colors ${done ? 'bg-success-50/60' : ''}`}
    >
      <button
        type="button"
        onClick={() => onChange('isWarmup', !set.isWarmup)}
        disabled={disabled}
        title={set.isWarmup ? 'Warm-up set (tap for working set)' : 'Working set (tap for warm-up)'}
        aria-label={`Set ${set.setNumber}: ${set.isWarmup ? 'warm-up' : 'working set'}. Toggle warm-up`}
        aria-pressed={!!set.isWarmup}
        className={`flex h-8 w-8 items-center justify-center justify-self-center rounded-lg text-sm font-bold transition-colors ${
          set.isWarmup ? 'bg-warning-100 text-warning-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {set.isWarmup ? 'W' : set.setNumber}
      </button>

      <span className="tabular hidden truncate text-sm text-gray-400 sm:block" title={previous ? 'Last time' : undefined}>
        {previous ? `${fmt(previous.weight)} × ${previous.reps}` : '—'}
      </span>

      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={set.weight}
        placeholder={previous ? fmt(previous.weight) : '0'}
        onChange={(e) => onChange('weight', e.target.value)}
        disabled={disabled}
        aria-label={`Set ${set.setNumber} weight (${units})`}
        className={input}
      />
      <input
        type="number"
        inputMode="numeric"
        value={set.reps}
        placeholder={previous ? String(previous.reps) : '0'}
        onChange={(e) => onChange('reps', e.target.value)}
        disabled={disabled}
        aria-label={`Set ${set.setNumber} reps`}
        className={input}
      />
      <select
        value={set.rpe ?? ''}
        onChange={(e) => onChange('rpe', e.target.value)}
        disabled={rpeDisabled}
        aria-label={`Set ${set.setNumber} RPE`}
        className={`h-10 w-full appearance-none bg-none px-0 text-center text-sm font-medium ${done ? '!border-success-200 !bg-success-50' : ''}`}
        style={{ backgroundImage: 'none', textAlignLast: 'center' }}
      >
        <option value="">–</option>
        {RPE_OPTIONS.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>

      {trackCompletion && (
        <button
          type="button"
          onClick={onToggleDone}
          disabled={disabled}
          aria-pressed={!!set.done}
          aria-label={set.done ? `Mark set ${set.setNumber} not done` : `Mark set ${set.setNumber} done`}
          className={`flex h-10 w-9 items-center justify-center justify-self-center rounded-xl transition-all active:scale-90 sm:w-10 ${
            set.done ? 'bg-success-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="flex h-10 w-7 items-center justify-center justify-self-center rounded-lg text-gray-300 sm:w-8 transition-colors hover:bg-danger-50 hover:text-danger-600"
        title="Delete set"
        aria-label={`Delete set ${set.setNumber}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default SetRow;
