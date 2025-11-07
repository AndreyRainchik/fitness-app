import React from 'react';

/**
 * StrengthScoreCard
 * 
 * Displays a summary card for a single lift showing:
 * - Exercise name
 * - Estimated 1RM
 * - Strength standard level
 * - Progress to next level
 * - Recent PR
 */
function StrengthScoreCard({ lift }) {
  if (!lift || lift.estimated1RM === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <p className="text-sm">No data available</p>
        </div>
      </div>
    );
  }

  // Color based on standard level
  const getStandardColor = (standard) => {
    const colors = {
      'Elite': 'text-purple-600',
      'Advanced': 'text-red-600',
      'Intermediate': 'text-orange-600',
      'Novice': 'text-yellow-600',
      'Beginner': 'text-green-600',
      'Untrained': 'text-gray-600',
    };
    return colors[standard] || 'text-gray-600';
  };

  const getBgColor = (standard) => {
    const colors = {
      'Elite': 'bg-purple-50',
      'Advanced': 'bg-red-50',
      'Intermediate': 'bg-orange-50',
      'Novice': 'bg-yellow-50',
      'Beginner': 'bg-green-50',
      'Untrained': 'bg-gray-50',
    };
    return colors[standard] || 'bg-gray-50';
  };

  const getBorderColor = (standard) => {
    const colors = {
      'Elite': 'border-purple-200',
      'Advanced': 'border-red-200',
      'Intermediate': 'border-orange-200',
      'Novice': 'border-yellow-200',
      'Beginner': 'border-green-200',
      'Untrained': 'border-gray-200',
    };
    return colors[standard] || 'border-gray-200';
  };

  // Calculate progress percentage to next level
  const getProgressPercentage = () => {
    if (!lift.nextLevel) return 100;
    const current = lift.estimated1RM;
    const target = lift.nextLevel.weight;
    // Assume we started from 0 for simplicity
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${getBorderColor(lift.standard)}`}>
      {/* 1RM Display */}
      <div className="mb-4">
        <p className="text-3xl md:text-4xl font-bold text-gray-900">
          {lift.estimated1RM}
          <span className="text-lg md:text-xl text-gray-500 ml-2">lbs</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">Estimated 1RM</p>
      </div>

      {/* Standard Badge */}
      <div className={`inline-block px-3 py-1 rounded-full ${getBgColor(lift.standard)} mb-4`}>
        <span className={`text-sm font-semibold ${getStandardColor(lift.standard)}`}>
          {lift.standard}
        </span>
        <span className="text-sm text-gray-600 ml-2">
          ({lift.percentile}th percentile)
        </span>
      </div>

      {/* Next Level Progress */}
      {lift.nextLevel && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Next: {lift.nextLevel.level}</span>
            <span className="font-semibold text-gray-700">{lift.nextLevel.weight} lbs</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {(lift.nextLevel.weight - lift.estimated1RM).toFixed(1)} lbs to go
          </p>
        </div>
      )}

      {/* Recent PR */}
      {lift.recentPR && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Recent PR</p>
          <p className="text-sm font-medium text-gray-900">
            {lift.recentPR.weight} lbs × {lift.recentPR.reps} reps
          </p>
          <p className="text-xs text-gray-500">
            {new Date(lift.recentPR.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export default StrengthScoreCard;