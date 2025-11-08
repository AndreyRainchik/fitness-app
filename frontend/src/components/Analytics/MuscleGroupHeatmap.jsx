import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/api';

const MuscleGroupHeatmap = () => {
  const [muscleData, setMuscleData] = useState([]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredMuscle, setHoveredMuscle] = useState(null);
  const [viewMode, setViewMode] = useState('front'); // 'front' or 'back'

  // Fetch muscle group data for the current week
  const fetchMuscleData = async (date) => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsAPI.getMuscleGroupsWeekly(
        date.toISOString().split('T')[0]
      );
      
      setMuscleData(data.muscleGroups);
      setWeekStart(data.weekStart);
      setWeekEnd(data.weekEnd);
    } catch (err) {
      console.error('Error fetching muscle data:', err);
      setError('Failed to load muscle group data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuscleData(currentDate);
  }, [currentDate]);

  // Navigate to previous week
  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  // Navigate to next week
  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // Navigate to current week
  const handleCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  // Get color intensity based on set count
  const getColorIntensity = (muscleGroup) => {
    const muscle = muscleData.find(m => 
      m.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
    );
    
    if (!muscle || muscle.setCount === 0) {
      return '#f3f4f6'; // gray-100 for unworked muscles
    }

    // Calculate max sets for scaling
    const maxSets = Math.max(...muscleData.map(m => m.setCount), 1);
    const intensity = Math.min(muscle.setCount / maxSets, 1);

    // Blue scale from light to dark
    if (intensity < 0.2) return '#dbeafe'; // blue-100
    if (intensity < 0.4) return '#93c5fd'; // blue-300
    if (intensity < 0.6) return '#60a5fa'; // blue-400
    if (intensity < 0.8) return '#3b82f6'; // blue-500
    return '#1d4ed8'; // blue-700
  };

  // Get set count for a muscle group
  const getSetCount = (muscleGroup) => {
    const muscle = muscleData.find(m => 
      m.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
    );
    return muscle ? muscle.setCount : 0;
  };

  // Format date range
  const formatDateRange = () => {
    if (!weekStart || !weekEnd) return '';
    
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    
    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  // Front view muscle groups with improved SVG paths
  const frontMuscleGroups = [
    {
      name: 'Chest',
      path: 'M160,95 Q155,90 150,90 Q145,90 140,95 L135,105 Q133,115 133,125 L135,140 Q138,148 145,152 L150,154 L155,152 Q162,148 165,140 L167,125 Q167,115 165,105 Z',
      label: { x: 150, y: 130 }
    },
    {
      name: 'Shoulders',
      path: 'M115,88 Q110,85 105,88 Q102,93 102,100 L105,115 Q108,122 115,125 Q120,127 125,122 L128,108 Q128,95 125,90 Q120,86 115,88 Z M185,88 Q190,85 195,88 Q198,93 198,100 L195,115 Q192,122 185,125 Q180,127 175,122 L172,108 Q172,95 175,90 Q180,86 185,88 Z',
      label: { x: 110, y: 105 }
    },
    {
      name: 'Biceps',
      path: 'M100,130 Q95,128 92,132 L88,145 Q87,155 88,165 L92,178 Q96,183 100,181 Q104,179 105,175 L107,160 Q108,145 105,135 Q103,130 100,130 Z M200,130 Q205,128 208,132 L212,145 Q213,155 212,165 L208,178 Q204,183 200,181 Q196,179 195,175 L193,160 Q192,145 195,135 Q197,130 200,130 Z',
      label: { x: 98, y: 155 }
    },
    {
      name: 'Forearms',
      path: 'M88,185 Q84,185 82,190 L80,210 Q79,225 80,235 L82,245 Q84,250 88,250 Q92,250 94,245 L96,230 Q97,210 95,195 Q93,188 88,185 Z M212,185 Q216,185 218,190 L220,210 Q221,225 220,235 L218,245 Q216,250 212,250 Q208,250 206,245 L204,230 Q203,210 205,195 Q207,188 212,185 Z',
      label: { x: 88, y: 215 }
    },
    {
      name: 'Core',
      path: 'M140,155 L135,160 Q133,165 133,172 L133,185 Q133,195 135,205 L138,218 Q140,225 145,228 L150,230 L155,228 Q160,225 162,218 L165,205 Q167,195 167,185 L167,172 Q167,165 165,160 L160,155 Z',
      label: { x: 150, y: 190 }
    },
    {
      name: 'Quadriceps',
      path: 'M130,235 L125,242 Q122,250 120,262 L118,280 Q117,295 118,308 L120,320 Q122,327 127,330 L132,332 Q136,330 138,325 L140,305 Q141,285 140,268 Q139,250 137,242 L133,235 Z M170,235 L167,242 Q161,250 163,262 L162,280 Q161,295 162,308 L164,320 Q166,327 171,330 L176,332 Q180,330 182,325 L184,305 Q185,285 184,268 Q183,250 181,242 L177,235 Z',
      label: { x: 135, y: 280 }
    },
    {
      name: 'Calves',
      path: 'M125,335 Q122,338 121,345 L119,360 Q118,372 119,383 L121,395 Q123,402 127,405 L131,407 Q135,405 137,400 L139,385 Q140,370 139,355 Q138,343 135,338 L131,335 Z M175,335 Q178,338 179,345 L181,360 Q182,372 181,383 L179,395 Q177,402 173,405 L169,407 Q165,405 163,400 L161,385 Q160,370 161,355 Q162,343 165,338 L169,335 Z',
      label: { x: 130, y: 370 }
    },
  ];

  // Back view muscle groups with improved SVG paths
  const backMuscleGroups = [
    {
      name: 'Traps',
      path: 'M150,85 L145,88 Q140,92 138,98 L135,108 Q134,115 136,122 L140,128 Q145,132 150,133 Q155,132 160,128 L164,122 Q166,115 165,108 L162,98 Q160,92 155,88 Z',
      label: { x: 150, y: 110 }
    },
    {
      name: 'Back',
      path: 'M118,125 Q113,128 110,135 L107,148 Q105,160 105,172 L107,188 Q109,198 114,204 L122,210 Q128,213 135,210 L140,205 Q142,198 142,188 L140,165 Q138,148 135,138 L130,130 Q125,126 118,125 Z M182,125 Q187,128 190,135 L193,148 Q195,160 195,172 L193,188 Q191,198 186,204 L178,210 Q172,213 165,210 L160,205 Q158,198 158,188 L160,165 Q162,148 165,138 L170,130 Q175,126 182,125 Z',
      label: { x: 120, y: 165 }
    },
    {
      name: 'Lower Back',
      path: 'M140,215 Q135,218 133,225 L132,235 Q132,245 134,253 L138,262 Q142,268 150,270 Q158,268 162,262 L166,253 Q168,245 168,235 L167,225 Q165,218 160,215 Z',
      label: { x: 150, y: 242 }
    },
    {
      name: 'Triceps',
      path: 'M100,130 L95,135 Q92,142 91,152 L90,165 Q90,175 92,183 L96,190 Q100,193 104,190 L108,183 Q110,175 110,165 L109,152 Q108,142 105,135 L102,130 Z M200,130 L205,135 Q208,142 209,152 L210,165 Q210,175 208,183 L204,190 Q200,193 196,190 L192,183 Q190,175 190,165 L191,152 Q192,142 195,135 L198,130 Z',
      label: { x: 100, y: 160 }
    },
    {
      name: 'Glutes',
      path: 'M132,270 Q128,273 126,280 L124,290 Q123,298 125,305 L128,312 Q132,317 138,318 L145,317 Q148,315 150,310 L150,295 Q149,283 146,276 L142,271 Z M168,270 Q172,273 174,280 L176,290 Q177,298 175,305 L172,312 Q168,317 162,318 L155,317 Q152,315 150,310 L150,295 Q151,283 154,276 L158,271 Z',
      label: { x: 150, y: 295 }
    },
    {
      name: 'Hamstrings',
      path: 'M130,320 Q126,325 124,335 L122,352 Q121,368 122,382 L125,395 Q128,402 133,403 L138,402 Q142,398 143,390 L144,370 Q144,350 142,338 Q140,328 136,323 L132,320 Z M170,320 Q174,325 176,335 L178,352 Q179,368 178,382 L175,395 Q172,402 167,403 L162,402 Q158,398 157,390 L156,370 Q156,350 158,338 Q160,328 164,323 L168,320 Z',
      label: { x: 133, y: 360 }
    },
  ];

  const currentMuscleGroups = viewMode === 'front' ? frontMuscleGroups : backMuscleGroups;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header with Week Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Weekly Muscle Groups</h2>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleCurrentWeek}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            This Week
          </button>
          
          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="text-center mb-4">
        <p className="text-sm font-medium text-gray-600">{formatDateRange()}</p>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={() => setViewMode('front')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'front'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setViewMode('back')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'back'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Body Visualization */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg
            viewBox="0 0 300 420"
            className="w-full max-w-sm"
            style={{ maxHeight: '500px' }}
          >
            {/* Head */}
            <ellipse
              cx="150"
              cy="70"
              rx="22"
              ry="25"
              fill="#f9fafb"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            
            {/* Neck */}
            <path
              d="M140,85 L140,95 L160,95 L160,85"
              fill="#f9fafb"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            
            {/* Body outline */}
            <path
              d="M130,95 Q125,98 122,105 L115,130 Q110,155 108,180 L106,210 Q105,230 108,248 L112,268 Q115,282 120,295 L125,315 Q128,330 130,345 L128,370 Q127,385 128,398 L130,410 M170,95 Q175,98 178,105 L185,130 Q190,155 192,180 L194,210 Q195,230 192,248 L188,268 Q185,282 180,295 L175,315 Q172,330 170,345 L172,370 Q173,385 172,398 L170,410"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            
            {/* Arms outline */}
            <path
              d="M122,105 L110,115 Q100,125 95,140 L90,160 Q87,180 88,200 L90,220 Q92,235 93,248 M178,105 L190,115 Q200,125 205,140 L210,160 Q213,180 212,200 L210,220 Q208,235 207,248"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            
            {/* Muscle groups */}
            {currentMuscleGroups.map((muscle) => (
              <g key={muscle.name}>
                <path
                  d={muscle.path}
                  fill={getColorIntensity(muscle.name)}
                  stroke="#6b7280"
                  strokeWidth="1.5"
                  className="transition-all duration-300 cursor-pointer hover:stroke-blue-500 hover:stroke-2"
                  style={{
                    filter: hoveredMuscle?.name === muscle.name ? 'brightness(1.1)' : 'none'
                  }}
                  onMouseEnter={() => setHoveredMuscle({ name: muscle.name, sets: getSetCount(muscle.name) })}
                  onMouseLeave={() => setHoveredMuscle(null)}
                />
              </g>
            ))}
          </svg>
          
          {/* Hover tooltip */}
          {hoveredMuscle && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-10">
              <span className="font-semibold">{hoveredMuscle.name}</span>
              <span className="mx-2">·</span>
              <span>{hoveredMuscle.sets} sets</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-center gap-2 text-sm mb-3">
          <span className="text-gray-600 font-medium">Intensity:</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-6 rounded border border-gray-300" style={{ backgroundColor: '#f3f4f6' }}></div>
            <span className="text-xs text-gray-500">0</span>
          </div>
          <div className="flex gap-1">
            {['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'].map((color, i) => (
              <div
                key={i}
                className="w-8 h-6 rounded border border-gray-300"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">Max</span>
        </div>
      </div>

      {/* Summary Stats */}
      {muscleData.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">
              {muscleData.reduce((sum, m) => sum + m.setCount, 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Total Sets</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">{muscleData.length}</p>
            <p className="text-sm text-gray-600 mt-1">Muscle Groups</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg col-span-2 sm:col-span-1">
            <p className="text-3xl font-bold text-green-600">
              {Math.round(muscleData.reduce((sum, m) => sum + m.setCount, 0) / muscleData.length)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Avg Sets/Group</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg mt-6">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 font-medium">No workouts this week</p>
          <p className="text-sm text-gray-400 mt-1">Start logging to see your muscle group activity</p>
        </div>
      )}
    </div>
  );
};

export default MuscleGroupHeatmap;