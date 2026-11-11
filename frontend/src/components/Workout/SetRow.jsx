import React from 'react';

const RPE_OPTIONS = [...Array(11).keys()]; // 0–10

function RpeSelect({ value, onChange, disabled, className }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="RPE"
      className={`w-full border rounded-md px-2 bg-white text-sm ${className}`}
    >
      <option value="">--</option>
      {RPE_OPTIONS.map((i) => (
        <option key={i} value={i}>{i}</option>
      ))}
    </select>
  );
}

function WarmupToggle({ checked, onChange, disabled }) {
  return (
    <label className="flex items-center text-xs text-gray-600 gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="rounded w-4 h-4"
      />
      <span>Warm-up</span>
    </label>
  );
}

function RemoveSetButton({ onClick, disabled, setNumber }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-danger-500 hover:text-danger-700 p-2 -m-1 rounded hover:bg-danger-50 transition-colors"
      title="Delete set"
      aria-label={`Delete set ${setNumber}`}
    >
      ✕
    </button>
  );
}

/**
 * One set in the workout editor: a stacked card on phones, a table row on
 * wider screens.
 *
 * onChange(field, value) with field in 'weight' | 'reps' | 'rpe' | 'isWarmup'.
 */
function SetRow({ set, units, onChange, onRemove, disabled = false }) {
  const weightProps = {
    type: 'number',
    step: '0.1',
    inputMode: 'decimal',
    value: set.weight,
    onChange: (e) => onChange('weight', e.target.value),
    disabled,
    'aria-label': `Set ${set.setNumber} weight`
  };
  const repsProps = {
    type: 'number',
    inputMode: 'numeric',
    value: set.reps,
    onChange: (e) => onChange('reps', e.target.value),
    disabled,
    'aria-label': `Set ${set.setNumber} reps`
  };
  const rpeDisabled = set.isWarmup || disabled;

  return (
    <div className="mb-3 sm:mb-2">
      {/* Phone layout */}
      <div className="sm:hidden bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Set {set.setNumber}</span>
          <div className="flex items-center gap-3">
            <WarmupToggle checked={set.isWarmup} onChange={(v) => onChange('isWarmup', v)} disabled={disabled} />
            <RemoveSetButton onClick={onRemove} disabled={disabled} setNumber={set.setNumber} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Weight</label>
            <input {...weightProps} placeholder={units} className="w-full border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reps</label>
            <input {...repsProps} className="w-full border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RPE</label>
            <RpeSelect value={set.rpe} onChange={(v) => onChange('rpe', v)} disabled={rpeDisabled} className="py-2" />
          </div>
        </div>
      </div>

      {/* Wider screens */}
      <div className="hidden sm:grid sm:grid-cols-12 gap-2 items-center">
        <div className="col-span-1 flex items-center justify-center">
          <RemoveSetButton onClick={onRemove} disabled={disabled} setNumber={set.setNumber} />
        </div>
        <div className="col-span-1 flex items-center justify-center">
          <span className="text-gray-700 font-medium text-sm">{set.setNumber}</span>
        </div>
        <div className="col-span-3">
          <input {...weightProps} className="w-full border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <input {...repsProps} className="w-full border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <RpeSelect value={set.rpe} onChange={(v) => onChange('rpe', v)} disabled={rpeDisabled} className="py-1.5" />
        </div>
        <div className="col-span-3">
          <WarmupToggle checked={set.isWarmup} onChange={(v) => onChange('isWarmup', v)} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

export default SetRow;
