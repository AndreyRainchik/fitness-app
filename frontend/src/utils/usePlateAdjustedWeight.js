import { useCallback, useMemo } from 'react';
import { usePlateInventory, usePlateSetups } from './usePlateInventory';
import { achievableWeight } from './plateMath';
import { useAuth } from '../context/AuthContext';

/**
 * Plate-adjusted weight for one programmed weight, computed locally from
 * the exercise's plate preset, else the active one (one shared request, no
 * request per weight).
 *
 * @returns {Object} { adjustedWeight, isAdjusted, loading, error }
 */
export const usePlateAdjustedWeight = (targetWeight, exerciseId) => {
  const { inventory, loading, error } = usePlateInventory(exerciseId);
  // Programmed weights are in the user's units; the plates may not be
  const units = useAuth().user?.units;
  return useMemo(() => {
    if (!targetWeight || targetWeight <= 0) return { adjustedWeight: null, isAdjusted: false, loading, error };
    if (!inventory) return { adjustedWeight: targetWeight, isAdjusted: false, loading, error };
    return { ...achievableWeight(targetWeight, inventory, units), loading, error };
  }, [targetWeight, inventory, units, loading, error]);
};

/**
 * Same, for many weights of many exercises: adjust(weight, exerciseId)
 * gives { adjustedWeight, isAdjusted } with each exercise's own plates.
 * While the plates load, weights come back as programmed.
 *
 * @returns {{ adjust: (weight: number, exerciseId?: number) => { adjustedWeight, isAdjusted }, loading, error }}
 */
export const usePlateAdjuster = () => {
  const { inventoryFor, loading, error } = usePlateSetups();
  const units = useAuth().user?.units;
  const adjust = useCallback((weight, exerciseId) => {
    const inventory = inventoryFor(exerciseId);
    if (!(weight > 0) || !inventory) return { adjustedWeight: weight, isAdjusted: false };
    return achievableWeight(weight, inventory, units);
  }, [inventoryFor, units]);
  return { adjust, loading, error };
};

export default usePlateAdjustedWeight;
