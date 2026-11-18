import { useMemo } from 'react';
import { usePlateInventory } from './usePlateInventory';
import { achievableWeight } from './plateMath';

/**
 * Plate-adjusted weight for one programmed weight, computed locally from
 * the active plate preset (one shared request, no request per weight).
 *
 * @returns {Object} { adjustedWeight, isAdjusted, loading, error }
 */
export const usePlateAdjustedWeight = (targetWeight) => {
  const { inventory, loading, error } = usePlateInventory();
  return useMemo(() => {
    if (!targetWeight || targetWeight <= 0) return { adjustedWeight: null, isAdjusted: false, loading, error };
    if (!inventory) return { adjustedWeight: targetWeight, isAdjusted: false, loading, error };
    return { ...achievableWeight(targetWeight, inventory), loading, error };
  }, [targetWeight, inventory, loading, error]);
};

/**
 * Same, for many weights at once.
 *
 * @param {Array<number>} targetWeights
 * @returns {{ weightsMap: Map<number, { adjustedWeight, isAdjusted }>, loading, error }}
 */
export const useBatchPlateAdjustedWeights = (targetWeights) => {
  const { inventory, loading, error } = usePlateInventory();
  const key = (targetWeights || []).join(',');
  const weightsMap = useMemo(() => {
    const map = new Map();
    if (!inventory) return map;
    for (const weight of new Set(targetWeights || [])) {
      if (weight > 0) map.set(weight, achievableWeight(weight, inventory));
    }
    return map;
    // key captures the contents of targetWeights
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, inventory]);
  return { weightsMap, loading, error };
};

export default usePlateAdjustedWeight;
