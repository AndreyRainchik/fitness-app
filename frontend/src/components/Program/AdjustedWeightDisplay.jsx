import React from 'react';
import { usePlateAdjustedWeight } from '../../utils/usePlateAdjustedWeight';

/**
 * Component to display weight with plate adjustment indicator
 * Shows adjusted weight in amber if it differs from programmed weight
 * 
 * @param {number} programmedWeight - The target weight from the program
 * @param {string} className - Additional CSS classes
 * @param {boolean} inline - Whether to show inline (true) or as block (false)
 */
const AdjustedWeightDisplay = ({ programmedWeight, className = '', inline = true }) => {
  const { adjustedWeight, isAdjusted, loading } = usePlateAdjustedWeight(programmedWeight);

  if (loading) {
    return (
      <span className={`text-gray-400 ${className}`}>
        {programmedWeight} lbs
      </span>
    );
  }

  if (!isAdjusted || !adjustedWeight) {
    // No adjustment needed - show normal weight
    return (
      <span className={className}>
        {programmedWeight} lbs
      </span>
    );
  }

  // Weight was adjusted - show in amber with indicator
  if (inline) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="text-amber-600 font-bold">
          {adjustedWeight} lbs
        </span>
        <span className="text-xs text-amber-600" title={`Adjusted from ${programmedWeight} lbs based on available plates`}>
          ⚠️
        </span>
        <span className="text-xs text-gray-500">
          (from {programmedWeight} lbs)
        </span>
      </span>
    );
  }

  // Block display with full message
  return (
    <div className={className}>
      <span className="text-amber-600 font-bold">
        {adjustedWeight} lbs
      </span>
      <div className="text-xs text-amber-600 mt-1">
        ⚠️ Adjusted from {programmedWeight} lbs based on available plates
      </div>
    </div>
  );
};

export default AdjustedWeightDisplay;