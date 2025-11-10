import { useState, useEffect, useRef } from 'react';
import { profileAPI } from '../services/api';

/**
 * Custom hook to get plate-adjusted weight based on user's plate inventory
 * Caches results to minimize API calls
 * 
 * @param {number} targetWeight - The programmed weight from the training program
 * @returns {Object} { adjustedWeight, isAdjusted, loading, error }
 */
export const usePlateAdjustedWeight = (targetWeight) => {
  const [adjustedWeight, setAdjustedWeight] = useState(null);
  const [isAdjusted, setIsAdjusted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cache to store results across all instances of the hook
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (!targetWeight || targetWeight <= 0) {
      setAdjustedWeight(null);
      setIsAdjusted(false);
      return;
    }

    // Check cache first
    const cacheKey = targetWeight.toString();
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setAdjustedWeight(cached.adjustedWeight);
      setIsAdjusted(cached.isAdjusted);
      return;
    }

    // Fetch from API
    const fetchAdjustedWeight = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await profileAPI.calculatePlates(targetWeight);
        
        // result contains: { plates, per_side, total, exact }
        const achievableWeight = result.total || targetWeight;
        const isExact = result.exact;
        const adjusted = !isExact || Math.abs(achievableWeight - targetWeight) > 0.01;
        
        // Cache the result
        cacheRef.current.set(cacheKey, {
          adjustedWeight: achievableWeight,
          isAdjusted: adjusted
        });
        
        setAdjustedWeight(achievableWeight);
        setIsAdjusted(adjusted);
      } catch (err) {
        console.error('Error fetching adjusted weight:', err);
        setError(err);
        // On error, use target weight as fallback
        setAdjustedWeight(targetWeight);
        setIsAdjusted(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAdjustedWeight();
  }, [targetWeight]);

  return { adjustedWeight, isAdjusted, loading, error };
};

/**
 * Hook variant that fetches multiple weights at once
 * More efficient when you need to adjust many weights
 * 
 * @param {Array<number>} targetWeights - Array of programmed weights
 * @returns {Map} Map of targetWeight -> { adjustedWeight, isAdjusted }
 */
export const useBatchPlateAdjustedWeights = (targetWeights) => {
  const [weightsMap, setWeightsMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!targetWeights || targetWeights.length === 0) {
      setWeightsMap(new Map());
      return;
    }

    const fetchAllWeights = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const results = new Map();
        
        // Fetch all weights in parallel
        const promises = targetWeights.map(async (weight) => {
          if (!weight || weight <= 0) return null;
          
          try {
            const result = await profileAPI.calculatePlates(weight);
            const achievableWeight = result.total || weight;
            const isExact = result.exact;
            const adjusted = !isExact || Math.abs(achievableWeight - weight) > 0.01;
            return {
              targetWeight: weight,
              adjustedWeight: achievableWeight,
              isAdjusted: adjusted
            };
          } catch (err) {
            console.error(`Error calculating plates for ${weight}:`, err);
            return {
              targetWeight: weight,
              adjustedWeight: weight,
              isAdjusted: false
            };
          }
        });
        
        const resolvedResults = await Promise.all(promises);
        
        // Build map from results
        resolvedResults.forEach(result => {
          if (result) {
            results.set(result.targetWeight, {
              adjustedWeight: result.adjustedWeight,
              isAdjusted: result.isAdjusted
            });
          }
        });
        
        setWeightsMap(results);
      } catch (err) {
        console.error('Error fetching batch weights:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllWeights();
  }, [JSON.stringify(targetWeights)]); // Use JSON.stringify for stable dependency

  return { weightsMap, loading, error };
};

export default usePlateAdjustedWeight;