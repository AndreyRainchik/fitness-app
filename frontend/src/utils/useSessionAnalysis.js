import { useEffect, useState } from 'react';
import { cardioAPI } from '../services/api';

/**
 * A session's analysis (charts, route, zones, best efforts). Only asked for
 * when the session came from Strava: hand-logged sessions have none.
 * Returns { analysis, loading }; analysis is null until loaded or on failure.
 */
export default function useSessionAnalysis(workoutId, fromStrava) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(Boolean(fromStrava));

  useEffect(() => {
    if (!fromStrava) {
      setAnalysis(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    cardioAPI.getAnalysis(workoutId)
      .then((result) => { if (!cancelled) setAnalysis(result); })
      .catch(() => { if (!cancelled) setAnalysis(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workoutId, fromStrava]);

  return { analysis, loading };
}
