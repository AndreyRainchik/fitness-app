import React from 'react';

/**
 * StrengthStandardsTable
 * 
 * Displays a comprehensive table showing:
 * - All main lifts
 * - Current 1RM vs standard levels
 * - Visual progress indicators
 * - Percentile rankings
 */
function StrengthStandardsTable({ strengthData }) {
  if (!strengthData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Strength Standards</h3>
        <div className="text-center text-gray-500 py-8">
          <p>No strength data available</p>
        </div>
      </div>
    );
  }

  const lifts = [
    { key: 'squat', name: 'Squat', icon: '🏋️' },
    { key: 'bench', name: 'Bench Press', icon: '💪' },
    { key: 'deadlift', name: 'Deadlift', icon: '⚡' },
    { key: 'ohp', name: 'Overhead Press', icon: '🎯' },
  ];

  // Standard levels for progression
  const standards = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

  // Get color for standard level
  const getStandardColor = (standard) => {
    const colors = {
      'Elite': 'bg-purple-600',
      'Advanced': 'bg-red-600',
      'Intermediate': 'bg-orange-600',
      'Novice': 'bg-yellow-600',
      'Beginner': 'bg-green-600',
      'Untrained': 'bg-gray-400',
    };
    return colors[standard] || 'bg-gray-400';
  };

  const getTextColor = (standard) => {
    const colors = {
      'Elite': 'text-purple-700',
      'Advanced': 'text-red-700',
      'Intermediate': 'text-orange-700',
      'Novice': 'text-yellow-700',
      'Beginner': 'text-green-700',
      'Untrained': 'text-gray-700',
    };
    return colors[standard] || 'text-gray-700';
  };

  // Calculate level index for progress bar
  const getLevelIndex = (standard) => {
    return standards.indexOf(standard);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          Strength Standards
        </h3>
        <p className="text-sm text-gray-600">
          Your current lifts compared to population standards
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lift
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current 1RM
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Standard
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Percentile
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lifts.map((lift) => {
              const data = strengthData[lift.key];
              if (!data || data.estimated1RM === 0) {
                return (
                  <tr key={lift.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{lift.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{lift.name}</span>
                      </div>
                    </td>
                    <td colSpan="5" className="px-6 py-4 text-sm text-gray-500">
                      No data available
                    </td>
                  </tr>
                );
              }

              const levelIndex = getLevelIndex(data.standard);
              const progressWidth = ((levelIndex + 1) / standards.length) * 100;

              return (
                <tr key={lift.key} className="hover:bg-gray-50">
                  {/* Lift Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{lift.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{lift.name}</span>
                    </div>
                  </td>

                  {/* Current 1RM */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {data.estimated1RM} lbs
                    </div>
                  </td>

                  {/* Standard */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      data.standard === 'Elite' ? 'bg-purple-100 text-purple-800' :
                      data.standard === 'Advanced' ? 'bg-red-100 text-red-800' :
                      data.standard === 'Intermediate' ? 'bg-orange-100 text-orange-800' :
                      data.standard === 'Novice' ? 'bg-yellow-100 text-yellow-800' :
                      data.standard === 'Beginner' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {data.standard}
                    </span>
                  </td>

                  {/* Percentile */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">
                      {data.percentile}th
                    </div>
                  </td>

                  {/* Next Level */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {data.nextLevel ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {data.nextLevel.level}
                        </div>
                        <div className="text-xs text-gray-500">
                          @ {data.nextLevel.weight} lbs
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Max level</span>
                    )}
                  </td>

                  {/* Progress Bar */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${getStandardColor(data.standard)}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">
                          {levelIndex + 1}/{standards.length}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {lifts.map((lift) => {
          const data = strengthData[lift.key];
          if (!data || data.estimated1RM === 0) {
            return (
              <div key={lift.key} className="p-4 bg-gray-50">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">{lift.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{lift.name}</span>
                </div>
                <p className="text-sm text-gray-500">No data available</p>
              </div>
            );
          }

          const levelIndex = getLevelIndex(data.standard);
          const progressWidth = ((levelIndex + 1) / standards.length) * 100;

          return (
            <div key={lift.key} className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{lift.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{lift.name}</span>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  data.standard === 'Elite' ? 'bg-purple-100 text-purple-800' :
                  data.standard === 'Advanced' ? 'bg-red-100 text-red-800' :
                  data.standard === 'Intermediate' ? 'bg-orange-100 text-orange-800' :
                  data.standard === 'Novice' ? 'bg-yellow-100 text-yellow-800' :
                  data.standard === 'Beginner' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {data.standard}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-600">Current 1RM</p>
                  <p className="text-lg font-bold text-gray-900">{data.estimated1RM} lbs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Percentile</p>
                  <p className="text-lg font-bold text-gray-900">{data.percentile}th</p>
                </div>
              </div>

              {/* Next Level */}
              {data.nextLevel && (
                <div className="mb-3">
                  <p className="text-xs text-gray-600 mb-1">
                    Next: {data.nextLevel.level} @ {data.nextLevel.weight} lbs
                  </p>
                </div>
              )}

              {/* Progress */}
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getStandardColor(data.standard)}`}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                Level {levelIndex + 1} of {standards.length}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer with Total */}
      {strengthData.total > 0 && (
        <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Powerlifting Total (Squat + Bench + Deadlift)
            </span>
            <span className="text-xl md:text-2xl font-bold text-blue-600">
              {strengthData.total} lbs
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StrengthStandardsTable;