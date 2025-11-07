import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { profileAPI } from '../../services/api';

function BodyweightChart({ units }) {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchChartData();
  }, [days]);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      // Get bodyweight logs for the selected time period
      const response = await profileAPI.getBodyweightLogs({ limit: 100 });
      
      // Filter and sort by date
      const logs = response.bodyweightLogs || [];
      const filtered = logs
        .filter(log => {
          const logDate = new Date(log.date);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          return logDate >= cutoffDate;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(log => ({
          ...log,
          // Format date for display
          dateFormatted: new Date(log.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'UTC' 
          })
        }));
      
      setChartData(filtered);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getMinMaxWeight = () => {
    if (chartData.length === 0) return { min: 0, max: 0 };
    const weights = chartData.map(log => log.weight);
    return {
      min: Math.min(...weights),
      max: Math.max(...weights)
    };
  };

  const { min, max } = getMinMaxWeight();
  const weightChange = chartData.length >= 2 
    ? chartData[chartData.length - 1].weight - chartData[0].weight 
    : 0;

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">
            {data.weight} {units}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(data.date).toLocaleDateString('en-US', { 
              weekday: 'short',
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Bodyweight Trend</h2>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Loading chart...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No data for this time period</p>
            <p className="text-sm text-gray-400">Log your bodyweight to see the trend</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
            <div className="text-center p-2 md:p-3 bg-blue-50 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Latest</p>
              <p className="text-lg md:text-xl font-bold text-blue-600">
                {chartData[chartData.length - 1].weight}
              </p>
              <p className="text-xs text-gray-500">{units}</p>
            </div>
            <div className="text-center p-2 md:p-3 bg-gray-50 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Change</p>
              <p className={`text-lg md:text-xl font-bold ${weightChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {weightChange >= 0 ? '+' : ''}{weightChange.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">{units}</p>
            </div>
            <div className="text-center p-2 md:p-3 bg-gray-50 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Entries</p>
              <p className="text-lg md:text-xl font-bold text-gray-600">
                {chartData.length}
              </p>
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
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  domain={[
                    (dataMin) => Math.floor(dataMin - 2),
                    (dataMax) => Math.ceil(dataMax + 2)
                  ]}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

export default BodyweightChart;