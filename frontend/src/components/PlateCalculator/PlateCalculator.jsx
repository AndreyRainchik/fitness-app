import { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';

/**
 * Get color for a plate weight (standard Olympic colors)
 */
const getPlateColor = (weight) => {
  const w = parseFloat(weight);
  
  // Red plates: 45 lbs, 25 kg
  if (w === 45 || w === 25) return 'bg-red-500';
  
  // Blue plates: 20 kg, 20 lbs
  if (w === 20) return 'bg-blue-500';
  
  // Yellow plates: 15 kg, 25 lbs
  if (w === 15 || w === 25) return 'bg-yellow-500';
  
  // Green plates: 10 kg, 10 lbs, 5 lbs, 5 kg
  if (w === 10 || w === 5) return 'bg-green-500';
  
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

/**
 * PlateCalculator Component
 * Shows what plates to load on the barbell for a target weight
 * Expandable/collapsible with click
 */
const PlateCalculator = ({ targetWeight, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [platesData, setPlatesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isExpanded && targetWeight) {
      calculatePlates();
    }
  }, [isExpanded, targetWeight]);

  const calculatePlates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileAPI.calculatePlates(targetWeight);
      setPlatesData(data);
    } catch (err) {
      console.error('Error calculating plates:', err);
      if(err.message.includes('active plate preset')) {
        setError('No active plate preset selected');
      } else {
        setError('Failed to calculate plates');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!targetWeight || targetWeight <= 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Toggle Button */}
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        aria-expanded={isExpanded}
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">Show plate loading</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {loading && (
            <div className="text-sm text-gray-600">Calculating plates...</div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {platesData && !loading && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{targetWeight} lbs</span>
                {' = '}
                <span>Bar ({platesData.total === targetWeight ? 'exact' : 'approx'})</span>
              </div>

              {/* Visual Barbell */}
              {platesData.plates && platesData.plates.length > 0 ? (
                <div className="flex items-center justify-center gap-1 py-2">
                  {/* Left side plates (smallest to largest from center) */}
                  <div className="flex items-center gap-1">
                    {[...platesData.plates].reverse().map((plate, index) => (
                      <div
                        key={`left-${index}`}
                        className={`
                          ${getPlateColor(plate)}
                          ${getTextColor(plate)}
                          px-2 py-3 rounded
                          text-xs font-bold
                          shadow-sm
                          min-w-[32px] text-center
                        `}
                        title={`${plate} lbs`}
                      >
                        {plate}
                      </div>
                    ))}
                  </div>

                  {/* Bar */}
                  <div className="px-3 py-2 bg-gray-700 text-white text-xs font-bold rounded">
                    BAR
                  </div>

                  {/* Right side plates (mirrored) */}
                  <div className="flex items-center gap-1">
                    {[...platesData.plates].map((plate, index) => (
                      <div
                        key={`right-${index}`}
                        className={`
                          ${getPlateColor(plate)}
                          ${getTextColor(plate)}
                          px-2 py-3 rounded
                          text-xs font-bold
                          shadow-sm
                          min-w-[32px] text-center
                        `}
                        title={`${plate} lbs`}
                      >
                        {plate}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="px-3 py-2 bg-gray-700 text-white text-xs font-bold rounded inline-block">
                    BAR ONLY
                  </div>
                </div>
              )}

              {/* Per Side Info */}
              {platesData.plates && platesData.plates.length > 0 && (
                <div className="text-xs text-gray-600 text-center">
                  <span className="font-medium">{platesData.per_side} lbs per side</span>
                  {' · '}
                  <span>{platesData.plates.length} plate{platesData.plates.length !== 1 ? 's' : ''} each side</span>
                </div>
              )}

              {/* Warning if not exact */}
              {!platesData.exact && (
                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  ⚠️ Approximate - insufficient plates for exact weight
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlateCalculator;