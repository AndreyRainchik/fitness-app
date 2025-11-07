import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../../services/api';

/**
 * WilksProgressChart
 * 
 * Displays Wilks score progression over time for all 4 main lifts
 * Used in Dashboard for quick analytics visualization
 */
function WilksProgressChart({ weeks = 12 }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWilksData();
  }, [weeks]);

  const loadWilksData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch progression data for all 4 main lifts
      const [squatData, benchData, deadliftData, ohpData] = await Promise.all([
        analyticsAPI.getLiftProgression('Barbell Squat', weeks).catch(() => ({ progression: [] })),
        analyticsAPI.getLiftProgression('Barbell Bench Press', weeks).catch(() => ({ progression: [] })),
        analyticsAPI.getLiftProgression('Barbell Deadlift', weeks).catch(() => ({ progression: [] })),
        analyticsAPI.getLiftProgression('Barbell Overhead Press', weeks).catch(() => ({ progression: [] })),
      ]);

      // Combine all dates from all lifts
      const allDates = new Set();
      [squatData.progression, benchData.progression, deadliftData.progression, ohpData.progression].forEach(data => {
        if (data) {
          data.forEach(point => allDates.add(point.date));
        }
      });

      // Sort dates
      const sortedDates = Array.from(allDates).sort();

      // Create data points for each date
      const combined = sortedDates.map(date => {
        const point = {
          date,
          dateFormatted: new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        };

        // Find Wilks score for each lift on this date
        const squatPoint = squatData.progression?.find(p => p.date === date);
        const benchPoint = benchData.progression?.find(p => p.date === date);
        const deadliftPoint = deadliftData.progression?.find(p => p.date === date);
        const ohpPoint = ohpData.progression?.find(p => p.date === date);

        if (squatPoint) point.squat = squatPoint.wilksScore;
        if (benchPoint) point.bench = benchPoint.wilksScore;
        if (deadliftPoint) point.deadlift = deadliftPoint.wilksScore;
        if (ohpPoint) point.ohp = ohpPoint.wilksScore;

        return point;
      });

      setChartData(combined);
    } catch (err) {
      console.error('Failed to load Wilks data:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            {new Date(payload[0].payload.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                <span className="font-medium">{entry.name}:</span> {entry.value?.toFixed(1)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Wilks Score Progress</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Wilks Score Progress</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Wilks Score Progress</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No progression data available</p>
            <p className="text-sm text-gray-400">
              Log workouts with main lifts to see your Wilks score trend
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          Wilks Score Progress
        </h3>
        <p className="text-sm text-gray-600">
          Tracking relative strength across all main lifts
        </p>
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
              label={{ value: 'Wilks Score', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="squat"
              name="Squat"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="bench"
              name="Bench"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="deadlift"
              name="Deadlift"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ohp"
              name="OHP"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Wilks coefficient normalizes strength across bodyweights, allowing fair comparison.
          Higher scores indicate greater relative strength.
        </p>
      </div>
    </div>
  );
}

export default WilksProgressChart;