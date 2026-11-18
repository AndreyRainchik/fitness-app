import React, { useEffect, useState } from 'react';
import { formatDuration, workoutElapsedMs } from '../../utils/workoutDraft';

/**
 * Elapsed training time for a timer object from utils/workoutDraft
 * ({ startedAt, pausedAt, pausedMs }). Time is computed from timestamps, so
 * it stays right across reloads and background tabs.
 */
function WorkoutTimer({ timer, className = '' }) {
  const [, setTick] = useState(0);
  const running = timer && !timer.pausedAt;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <span className={`tabular ${className}`} role="timer" aria-label="Workout duration">
      {formatDuration(workoutElapsedMs(timer))}
    </span>
  );
}

export default WorkoutTimer;
