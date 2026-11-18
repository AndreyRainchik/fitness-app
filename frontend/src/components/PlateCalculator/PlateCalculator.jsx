import { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';

/**
 * Get color for a plate weight (standard Olympic colors)
 */
const getPlateColor = (weight) => {
  const w = parseFloat(weight);
  
  // Red plates: 45 lbs, 25 kg
  if (w === 45 || w === 25) return 'bg-danger-500';
  
  // Blue plates: 20 kg, 20 lbs
  if (w === 20) return 'bg-primary-500';
  
  // Yellow plates: 15 kg, 25 lbs
  if (w === 15) return 'bg-yellow-500';
  
  // Green plates: 10 kg, 10 lbs, 5 lbs, 5 kg
  if (w === 10 || w === 5) return 'bg-success-500';
  
  // Gray/White plates: 2.5 and smaller
  if (w === 2.5) return 'bg-gray-400';
  if (w === 1.25 || w === 1) return 'bg-gray-300';
  
  // Very small plates
  return 'bg-gray-200';
};

/**
 * Get text color for contrast
 */
const getTextColor = (weight) => {
  const w = parseFloat(weight);
  // Light text for darker plates
  if (w >= 10) return 'text-white';
  // Dark text for lighter plates
  return 'text-gray-800';
};

// Plate height by weight, so the bar reads like the real thing
const plateHeight = (weight) => {
  const w = parseFloat(weight);
  if (w >= 35) return 'h-14';
  if (w >= 25) return 'h-12';
  if (w >= 10) return 'h-10';
  if (w >= 5) return 'h-8';
  return 'h-6';
};

/**
 * What to load for a target weight: one side of the bar (the other side
 * mirrors it), plus the per-side total. Fetches when mounted.
 */
export function PlateLoadout({ targetWeight }) {
  const [platesData, setPlatesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await profileAPI.calculatePlates(targetWeight);
        if (!cancelled) setPlatesData(data);
      } catch (err) {
        console.error('Error calculating plates:', err);
        if (!cancelled) {
          setError(err.message?.includes('active plate preset') ? 'No active plate preset selected' : 'Failed to calculate plates');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetWeight]);

  return (
    <div className="rounded-xl bg-gray-50 p-3">
      {loading && <div className="text-sm text-gray-500">Calculating plates…</div>}
      {error && <div className="text-sm text-danger-600">{error}</div>}
      {platesData && !loading && (
        <>
          {platesData.plates && platesData.plates.length > 0 ? (
            <div className="flex items-center gap-3">
              {/* One side of the bar: sleeve, then plates heaviest first */}
              <div className="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none" aria-label="Plates per side">
                <span className="h-3 w-6 flex-shrink-0 rounded-l-sm bg-gray-400" aria-hidden="true" />
                <span className="h-5 w-1.5 flex-shrink-0 rounded-sm bg-gray-500" aria-hidden="true" />
                <span className="flex items-center gap-[3px] pl-[3px]">
                  {platesData.plates.map((plate, index) => (
                    <span
                      key={index}
                      className={`${getPlateColor(plate)} ${getTextColor(plate)} ${plateHeight(plate)} flex w-7 flex-shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold shadow-sm`}
                      title={`${plate} lbs`}
                    >
                      {plate}
                    </span>
                  ))}
                </span>
                <span className="h-3 w-8 flex-shrink-0 rounded-r-sm bg-gray-400" aria-hidden="true" />
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="tabular text-sm font-semibold text-gray-900">{platesData.per_side} lbs</p>
                <p className="text-[11px] text-gray-500">per side</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-700">Empty bar</p>
          )}
          {!platesData.exact && (
            <p className="mt-2 rounded-lg bg-warning-50 px-2 py-1 text-xs text-warning-700">
              Approximate: not enough plates for {targetWeight} lbs exactly
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * PlateCalculator: a "Plates" toggle that reveals PlateLoadout.
 */
const PlateCalculator = ({ targetWeight, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!targetWeight || targetWeight <= 0) {
    return null;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="-mx-2 flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
        aria-expanded={isExpanded}
      >
        <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Plate loading
      </button>
      {isExpanded && <div className="mt-1"><PlateLoadout targetWeight={targetWeight} /></div>}
    </div>
  );
};

export default PlateCalculator;
