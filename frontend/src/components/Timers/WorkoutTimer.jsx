import React, { useState, useEffect, useRef } from 'react';

/**
 * WorkoutTimer - Counts up from 0, showing total workout duration
 * Props:
 *   - isRunning: boolean - whether timer is actively counting
 *   - onTimeUpdate: function - callback with current seconds
 */
function WorkoutTimer({ isRunning, onTimeUpdate }) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prevSeconds => {
          const newSeconds = prevSeconds + 1;
          if (onTimeUpdate) {
            onTimeUpdate(newSeconds);
          }
          return newSeconds;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onTimeUpdate]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="text-sm font-medium text-gray-600 mb-2">Workout Duration</div>
      <div className="text-5xl font-bold text-blue-600 font-mono">
        {formatTime(seconds)}
      </div>
      <div className="mt-2">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          isRunning 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${
            isRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
          }`}></span>
          {isRunning ? 'Active' : 'Paused'}
        </span>
      </div>
    </div>
  );
}

export default WorkoutTimer;