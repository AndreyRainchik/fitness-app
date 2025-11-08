import React, { useState, useEffect, useRef } from 'react';

/**
 * RestTimer - Counts down from a specified duration
 * Props:
 *   - duration: number - total seconds to count down
 *   - isActive: boolean - whether timer is running
 *   - onComplete: function - callback when timer reaches 0
 *   - onSkip: function - callback when user skips timer
 */
function RestTimer({ duration = 180, isActive, onComplete, onSkip }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // Reset timer when it becomes active
  useEffect(() => {
    if (isActive) {
      setSecondsLeft(duration);
    }
  }, [isActive, duration]);

  useEffect(() => {
    if (isActive && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            // Play completion sound (optional - can be disabled)
            if (audioRef.current) {
              audioRef.current.play().catch(() => {
                // Ignore autoplay errors
              });
            }
            if (onComplete) {
              onComplete();
            }
            return 0;
          }
          return prev - 1;
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
  }, [isActive, secondsLeft, onComplete]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return ((duration - secondsLeft) / duration) * 100;
  };

  const handleSkip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setSecondsLeft(0);
    if (onSkip) {
      onSkip();
    }
  };

  if (!isActive || secondsLeft === 0) {
    return null;
  }

  const isAlmostDone = secondsLeft <= 10;

  return (
    <>
      {/* Hidden audio element for completion sound */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZTA8OVqzn77BdGAg+ltryxnMpBSl+zPLaizsIGGS57OihUBELTKXh8bllHAU2jdXzz3oqBSd4yO/ekEIKElyx6OytWBUIQ5ziT" preload="auto" />
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-blue-600 shadow-2xl z-50 animate-slideUp">
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div 
            className={`h-full transition-all duration-1000 ease-linear ${
              isAlmostDone ? 'bg-red-500' : 'bg-blue-600'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Timer Display */}
            <div className="flex items-center space-x-4">
              <div className={`text-5xl font-bold font-mono ${
                isAlmostDone ? 'text-red-600 animate-pulse' : 'text-blue-600'
              }`}>
                {formatTime(secondsLeft)}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-600">Rest Timer</div>
                <div className="text-xs text-gray-500">
                  {isAlmostDone ? 'Almost done!' : 'Take your time'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleSkip}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition duration-200"
              >
                Skip Rest
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default RestTimer;