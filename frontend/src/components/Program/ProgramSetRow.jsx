import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';
import { PlateLoadout } from '../PlateCalculator/PlateCalculator';

const LABEL_TONES = {
  warmup: 'bg-warning-100 text-warning-700',
  main: 'bg-primary-50 text-primary-700',
  accessory: 'bg-gray-100 text-gray-600',
};

/**
 * One prescribed set on the This Week screen: label, weight × reps, a
 * caption, and a button that shows the plate loadout underneath (with
 * the exercise's own plate set, if it has one).
 */
function ProgramSetRow({ label, tone = 'main', weight, reps, caption, badge, plateWeight, exerciseId }) {
  const [showPlates, setShowPlates] = useState(false);
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <span className={`flex h-8 min-w-[2.25rem] flex-shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold ${LABEL_TONES[tone] ?? LABEL_TONES.main}`}>
          {label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            {weight}
            <span className="tabular text-sm text-gray-500">× {reps}</span>
            {badge}
          </span>
          {caption && <span className="block truncate text-xs text-gray-400">{caption}</span>}
        </span>
        {plateWeight > 0 && (
          <button
            type="button"
            onClick={() => setShowPlates((v) => !v)}
            aria-expanded={showPlates}
            aria-label={showPlates ? 'Hide plate loading' : 'Show plate loading'}
            title="Plate loading"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
              showPlates ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Disc3 className="h-4 w-4" />
          </button>
        )}
      </div>
      {showPlates && (
        <div className="mt-2 animate-fade-in">
          <PlateLoadout targetWeight={plateWeight} exerciseId={exerciseId} />
        </div>
      )}
    </li>
  );
}

export default ProgramSetRow;
