import { useEffect, useState } from 'react';
import { workoutsAPI } from '../services/api';

// exerciseId:exclude -> Promise<last | null>. Lives for the page session.
const cache = new Map();

/** Forget cached results (call after saving a workout). */
export function clearLastPerformanceCache() {
  cache.clear();
}

/**
 * The most recent logged sets for an exercise, or null.
 * Returns undefined while loading.
 */
export function useLastPerformance(exerciseId, excludeWorkoutId) {
  const key = exerciseId ? `${exerciseId}:${excludeWorkoutId ?? ''}` : null;
  const [result, setResult] = useState({ key: null, last: undefined });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    if (!cache.has(key)) {
      cache.set(
        key,
        workoutsAPI.getLastPerformance(exerciseId, excludeWorkoutId)
          .then((res) => res.last ?? null)
          .catch(() => {
            cache.delete(key);
            return null;
          })
      );
    }
    cache.get(key).then((last) => {
      if (!cancelled) setResult({ key, last });
    });
    return () => { cancelled = true; };
  }, [key, exerciseId, excludeWorkoutId]);

  if (!key) return null;
  return result.key === key ? result.last : undefined;
}
