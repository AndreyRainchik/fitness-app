import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/api';
import { localDateStringFromDate } from '../../utils/dateUtils';

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
        localDateStringFromDate(date)
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
    
    const options = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  // ANATOMICALLY ACCURATE FRONT VIEW
  const frontMuscleGroups = [
    {
      name: 'Chest',
      // Pectorals: Two large plates meeting at the sternum
      path: 'M150,95 L150,145 L135,148 C120,145 115,130 112,110 C112,100 125,90 150,95 Z M150,95 L150,145 L165,148 C180,145 185,130 188,110 C188,100 175,90 150,95 Z',
      label: { x: 150, y: 120 }
    },
    {
      name: 'Shoulders',
      // Deltoids: Wrapping around the shoulder joint
      path: 'M112,110 C108,105 102,95 105,85 C115,80 135,85 140,88 L135,93 C128,90 120,95 112,110 Z M188,110 C192,105 198,95 195,85 C185,80 165,85 160,88 L165,93 C172,90 180,95 188,110 Z',
      label: { x: 110, y: 95 }
    },
    {
      name: 'Biceps',
      // Upper arm muscles
      path: 'M110,115 C105,125 102,135 102,145 C105,150 112,148 115,140 C116,130 115,120 110,115 Z M190,115 C195,125 198,135 198,145 C195,150 188,148 185,140 C184,130 185,120 190,115 Z',
      label: { x: 95, y: 135 }
    },
    {
      name: 'Forearms',
      // Lower arm muscles
      path: 'M100,148 C95,155 92,170 94,185 C95,190 100,190 102,185 C105,170 104,155 100,148 Z M200,148 C205,155 208,170 206,185 C205,190 200,190 198,185 C195,170 196,155 200,148 Z',
      label: { x: 88, y: 170 }
    },
    {
      name: 'Core',
      // Abdominals and Obliques
      path: 'M135,148 L150,145 L165,148 C168,160 165,190 160,205 L150,210 L140,205 C135,190 132,160 135,148 Z',
      label: { x: 150, y: 180 }
    },
    {
      name: 'Quadriceps',
      // Thigh muscles with teardrop shape
      path: 'M138,210 C130,220 125,240 128,270 C130,280 135,285 140,280 C145,270 148,240 145,215 L138,210 Z M162,210 C170,220 175,240 172,270 C170,280 165,285 160,280 C155,270 152,240 155,215 L162,210 Z',
      label: { x: 130, y: 250 }
    },
    {
      name: 'Calves',
      // Lower leg muscles
      path: 'M130,295 C125,305 125,325 128,345 C130,355 135,355 138,345 C140,330 138,305 135,295 Z M170,295 C175,305 175,325 172,345 C170,355 165,355 162,345 C160,330 162,305 165,295 Z',
      label: { x: 128, y: 325 }
    },
  ];

  // ANATOMICALLY ACCURATE BACK VIEW
  const backMuscleGroups = [
    {
      name: 'Traps',
      // Upper back/neck muscle (kite shape)
      path: 'M150,80 L165,90 L160,110 L150,125 L140,110 L135,90 Z',
      label: { x: 150, y: 100 }
    },
    {
      name: 'Back',
      // Latissimus Dorsi (Wings)
      path: 'M135,105 L125,115 C120,130 125,155 135,175 L150,190 L165,175 C175,155 180,130 175,115 L165,105 L160,125 L150,135 L140,125 Z',
      label: { x: 125, y: 150 }
    },
    {
      name: 'Lower Back',
      // Erector Spinae
      path: 'M142,180 L150,190 L158,180 L158,205 C158,210 155,215 150,215 C145,215 142,210 142,205 Z',
      label: { x: 150, y: 200 }
    },
    {
      name: 'Triceps',
      // Back of upper arm
      path: 'M115,110 C108,115 105,125 105,135 C108,145 115,140 118,135 C120,125 118,115 115,110 Z M185,110 C192,115 195,125 195,135 C192,145 185,140 182,135 C180,125 182,115 185,110 Z',
      label: { x: 105, y: 130 }
    },
    {
      name: 'Glutes',
      // Buttocks
      path: 'M135,215 C130,225 130,245 135,255 C140,260 148,260 150,250 L150,215 L135,215 Z M165,215 C170,225 170,245 165,255 C160,260 152,260 150,250 L150,215 L165,215 Z',
      label: { x: 150, y: 240 }
    },
    {
      name: 'Hamstrings',
      // Back of thighs
      path: 'M135,260 C130,270 130,300 135,315 C138,320 145,315 148,310 C150,290 145,270 135,260 Z M165,260 C170,270 170,300 165,315 C162,320 155,315 152,310 C150,290 155,270 165,260 Z',
      label: { x: 135, y: 290 }
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
            {/* Base Human Silhouette (Neutral Gray) */}
            <g fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1">
                {/* Head */}
                <path d="M150,40 C138,40 130,50 130,65 C130,82 140,90 150,90 C160,90 170,82 170,65 C170,50 162,40 150,40 Z" />
                {/* Neck */}
                <rect x="142" y="85" width="16" height="15" rx="4" />
                {/* Skeleton/Joints Connectors (Elbows, Knees, Ankles, Hands) */}
                <path d="M92,185 L90,200 L100,210 L110,200 L108,185 Z" /> {/* Left Hand */}
                <path d="M208,185 L210,200 L200,210 L190,200 L192,185 Z" /> {/* Right Hand */}
                <circle cx="135" cy="285" r="6" /> {/* Left Knee */}
                <circle cx="165" cy="285" r="6" /> {/* Right Knee */}
                <path d="M128,345 L125,360 L145,360 L142,345 Z" /> {/* Left Foot */}
                <path d="M172,345 L175,360 L155,360 L158,345 Z" /> {/* Right Foot */}
            </g>

            {/* Muscle Groups Layer */}
            {currentMuscleGroups.map((muscle) => (
              <g key={muscle.name}>
                <path
                  d={muscle.path}
                  fill={getColorIntensity(muscle.name)}
                  stroke="#9ca3af" // Gray-400 stroke for definition
                  strokeWidth="1"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer hover:stroke-blue-600 hover:stroke-2"
                  style={{
                    filter: hoveredMuscle?.name === muscle.name ? 'brightness(1.1) drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))' : 'none'
                  }}
                  onMouseEnter={() => setHoveredMuscle({ name: muscle.name, sets: getSetCount(muscle.name) })}
                  onMouseLeave={() => setHoveredMuscle(null)}
                />
              </g>
            ))}
          </svg>
          
          {/* Hover tooltip */}
          {hoveredMuscle && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-10 pointer-events-none">
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