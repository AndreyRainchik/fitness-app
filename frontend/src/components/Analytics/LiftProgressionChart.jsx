import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * LiftProgressionChart
 * 
 * Displays progression over time for a specific lift showing:
 * - Estimated 1RM trend line
 * - Wilks score (optional)
 * - Data points with tooltips
 */
function LiftProgressionChart({ data, exerciseName }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{exerciseName} Progression</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No progression data available</p>
            <p className="text-sm text-gray-400">
              Log workouts with {exerciseName} to see your progress
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map(point => ({
    ...point,
    dateFormatted: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }));

  // Calculate statistics
  const latestValue = data[data.length - 1];
  const firstValue = data[0];
  const improvement = latestValue.estimated1RM - firstValue.estimated1RM;
  const improvementPercent = ((improvement / firstValue.estimated1RM) * 100).toFixed(1);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            {new Date(data.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-gray-700">
              <span className="font-medium">1RM:</span> {data.estimated1RM} lbs
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Best Set:</span> {data.weight} × {data.reps}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Wilks:</span> {data.wilksScore}
            </p>
            <p className="text-sm">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                data.standard === 'Elite' ? 'bg-purple-100 text-purple-700' :
                data.standard === 'Advanced' ? 'bg-red-100 text-red-700' :
                data.standard === 'Intermediate' ? 'bg-orange-100 text-orange-700' :
                data.standard === 'Novice' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {data.standard}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          {exerciseName} Progression
        </h3>
        <p className="text-sm text-gray-600">
          Tracking your estimated 1RM over time
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
        <div className="text-center p-2 md:p-3 bg-blue-50 rounded-lg">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Current</p>
          <p className="text-lg md:text-2xl font-bold text-blue-600">
            {latestValue.estimated1RM}
          </p>
          <p className="text-xs text-gray-500">lbs</p>
        </div>
        <div className="text-center p-2 md:p-3 bg-green-50 rounded-lg">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Improved</p>
          <p className={`text-lg md:text-2xl font-bold ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500">{improvementPercent}%</p>
        </div>
        <div className="text-center p-2 md:p-3 bg-purple-50 rounded-lg">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Level</p>
          <p className="text-sm md:text-base font-bold text-purple-600">
            {latestValue.standard}
          </p>
          <p className="text-xs text-gray-500">{latestValue.percentile}%ile</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateFormatted"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ value: '1RM (lbs)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="estimated1RM"
              name="Estimated 1RM"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="wilksScore"
              name="Wilks Score"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Points Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Showing {data.length} data point{data.length !== 1 ? 's' : ''} from{' '}
          {new Date(firstValue.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to{' '}
          {new Date(latestValue.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

export default LiftProgressionChart;