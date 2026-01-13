import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { programsAPI } from '../services/api';
import PlateCalculator from '../components/PlateCalculator/PlateCalculator';
import Layout from '../components/Layout/Layout';
import { useBatchPlateAdjustedWeights } from '../utils/usePlateAdjustedWeight';

const CurrentWeek = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [updatingStatus, setUpdatingStatus] = useState(new Set()); // Track which exercises are being updated

  // NEW: State for tracking all statuses across the cycle
  const [allStatuses, setAllStatuses] = useState(null);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // State for tracking collapsed lifts (completed/failed lifts collapse by default)
  const [collapsedLifts, setCollapsedLifts] = useState(new Set());

  // Collect all weights from workout for batch fetching (INCLUDING WARMUP SETS)
  const allWeights = useMemo(() => {
    if (!workout || !workout.lifts) return [];
    
    const weights = [];
    workout.lifts.forEach(lift => {
      // NEW: Warmup sets (for both program types)
      if (lift.warmup_sets) {
        lift.warmup_sets.forEach(set => weights.push(set.weight));
      }
      
      if (workout.program_type === '531') {
        // Main sets
        if (lift.main_sets) {
          lift.main_sets.forEach(set => weights.push(set.weight));
        }
        // BBB accessory sets
        if (lift.accessory_sets && lift.accessory_sets.length > 0) {
          weights.push(lift.accessory_sets[0].weight);
        }
      } else if (workout.program_type === 'starting_strength') {
        // Starting Strength sets
        if (lift.sets && lift.sets.length > 0) {
          weights.push(lift.sets[0].weight);
        }
      }
    });
    
    return [...new Set(weights)]; // Remove duplicates
  }, [workout]);

  // Fetch adjusted weights for all programmed weights
  const { weightsMap, loading: weightsLoading } = useBatchPlateAdjustedWeights(allWeights);

  // Helper function to get adjusted weight info
  const getAdjustedWeightInfo = (programmedWeight) => {
    if (weightsLoading || !weightsMap.has(programmedWeight)) {
      return {
        weight: programmedWeight,
        isAdjusted: false
      };
    }
    
    const info = weightsMap.get(programmedWeight);
    return {
      weight: info.adjustedWeight,
      isAdjusted: info.isAdjusted
    };
  };

  // Component to display weight with adjustment indicator
  const WeightDisplay = ({ programmedWeight, className = '' }) => {
    const { weight, isAdjusted } = getAdjustedWeightInfo(programmedWeight);
    
    if (!isAdjusted) {
      return (
        <span className={`text-base sm:text-lg font-bold text-blue-600 ${className}`}>
          {weight} lbs
        </span>
      );
    }
    
    return (
      <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
        <span className="text-base sm:text-lg font-bold text-amber-600">
          {weight} lbs
        </span>
        <span className="text-xs text-amber-600" title={`Adjusted from ${programmedWeight} lbs based on available plates`}>
          ⚠️
        </span>
        <span className="text-xs text-gray-500">
          (from {programmedWeight})
        </span>
      </span>
    );
  };

  // NEW: Helper function to check if a lift failed in ANY week of the current cycle
  const hasFailureInCycle = (exerciseId) => {
    if (!allStatuses || !workout) return false;
    
    // Filter statuses for this exercise in the current cycle
    const exerciseStatuses = allStatuses.statuses.filter(
      status => status.exercise_id === exerciseId && status.cycle === workout.cycle
    );
    
    // Check if any status in weeks 1-4 is 'failed'
    return exerciseStatuses.some(status => status.status === 'failed');
  };

  // NEW: Get which weeks had failures for display purposes
  const getFailedWeeks = (exerciseId) => {
    if (!allStatuses || !workout) return [];
    
    return allStatuses.statuses
      .filter(
        status => 
          status.exercise_id === exerciseId && 
          status.cycle === workout.cycle && 
          status.status === 'failed'
      )
      .map(status => status.week)
      .sort((a, b) => a - b);
  };

  useEffect(() => {
    if (programId) {
      loadCurrentWeek();
    } else {
      loadActiveProgram();
    }
  }, [programId]);

  // Initialize collapsed state when workout loads - collapse completed/failed lifts
  useEffect(() => {
    if (workout && workout.lifts) {
      const initialCollapsed = new Set();
      workout.lifts.forEach(lift => {
        if (lift.status === 'completed' || lift.status === 'failed') {
          initialCollapsed.add(lift.exercise_id);
        }
      });
      setCollapsedLifts(initialCollapsed);
    }
  }, [workout?.program_id, workout?.week, workout?.cycle, workout?.session_number]);

  // Toggle collapse state for a lift
  const toggleLiftCollapse = (exerciseId) => {
    setCollapsedLifts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  };

  // Check if a lift is collapsed
  const isLiftCollapsed = (exerciseId) => collapsedLifts.has(exerciseId);

  // NEW: Effect to load all statuses when workout is loaded
  useEffect(() => {
    if (workout && workout.program_id && workout.program_type === '531') {
      loadAllStatuses(workout.program_id);
    }
  }, [workout?.program_id]);

  // NEW: Load all statuses for the program
  const loadAllStatuses = async (progId) => {
    try {
      setLoadingStatuses(true);
      const statusData = await programsAPI.getAllStatuses(progId);
      setAllStatuses(statusData);
    } catch (error) {
      console.error('Error loading all statuses:', error);
      // Don't show error to user - this is supplementary data
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadActiveProgram = async () => {
    try {
      setLoading(true);
      const activeProgram = await programsAPI.getActive();
      if (activeProgram && activeProgram.id) {
        const workoutData = await programsAPI.getCurrentWeek(activeProgram.id);
        setWorkout(workoutData);
      } else {
        setMessage({ type: 'error', text: 'No active program found. Create a program first.' });
      }
    } catch (error) {
      console.error('Error loading active program:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load workout' });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentWeek = async () => {
    try {
      setLoading(true);
      const workoutData = await programsAPI.getCurrentWeek(programId);
      setWorkout(workoutData);
    } catch (error) {
      console.error('Error loading current week:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load workout' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteWeek = async () => {
    // Check for failed lifts
    const failedLifts = workout.lifts.filter(lift => lift.status === 'failed');
    
    let confirmMessage = 'Mark this week as complete and advance to next week?';
    
    if (failedLifts.length > 0) {
      const liftNames = failedLifts.map(lift => lift.exercise_name).join(', ');
      confirmMessage = `You have ${failedLifts.length} failed lift(s): ${liftNames}\n\n` +
        `Their training max/weight will be DECREASED by the increment amount.\n\n` +
        `Continue and advance to next week?`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setAdvancing(true);
      await programsAPI.advanceWeek(workout.program_id);
      
      if (failedLifts.length > 0) {
        setMessage({ 
          type: 'success', 
          text: `Advanced to next week. Training max decreased for ${failedLifts.length} failed lift(s).` 
        });
      } else {
        setMessage({ type: 'success', text: 'Advanced to next week!' });
      }
      
      // Reload the workout
      if (programId) {
        await loadCurrentWeek();
      } else {
        await loadActiveProgram();
      }
    } catch (error) {
      console.error('Error advancing week:', error);
      setMessage({ type: 'error', text: 'Failed to advance week' });
    } finally {
      setAdvancing(false);
    }
  };

  /**
   * Handle setting lift status (completed, failed, or skipped)
   */
  const handleSetStatus = async (exerciseId, status) => {
    try {
      // Add to updating set
      setUpdatingStatus(prev => new Set(prev).add(exerciseId));

      await programsAPI.setLiftStatus(workout.program_id, exerciseId, status);

      // Auto-collapse if marking as completed or failed
      if (status === 'completed' || status === 'failed') {
        setCollapsedLifts(prev => new Set(prev).add(exerciseId));
      }

      // Reload workout to get updated status
      if (programId) {
        await loadCurrentWeek();
      } else {
        await loadActiveProgram();
      }

      // Show success message briefly
      const statusText = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'skipped';
      setMessage({ type: 'success', text: `Marked as ${statusText}` });
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (error) {
      console.error('Error setting lift status:', error);
      setMessage({ type: 'error', text: 'Failed to update status' });
    } finally {
      // Remove from updating set
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseId);
        return newSet;
      });
    }
  };

  /**
   * Handle clearing lift status
   */
  const handleClearStatus = async (exerciseId) => {
    try {
      setUpdatingStatus(prev => new Set(prev).add(exerciseId));

      await programsAPI.clearLiftStatus(workout.program_id, exerciseId);

      // Expand the lift when status is cleared
      setCollapsedLifts(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseId);
        return newSet;
      });

      // Reload workout to get updated status
      if (programId) {
        await loadCurrentWeek();
      } else {
        await loadActiveProgram();
      }

      setMessage({ type: 'success', text: 'Status cleared' });
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (error) {
      console.error('Error clearing lift status:', error);
      setMessage({ type: 'error', text: 'Failed to clear status' });
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseId);
        return newSet;
      });
    }
  };

  /**
   * Get border color class based on status
   */
  const getStatusBorderClass = (status) => {
    if (status === 'completed') return 'border-green-500 border-2';
    if (status === 'failed') return 'border-red-500 border-2';
    if (status === 'skipped') return 'border-yellow-500 border-2';
    return 'border-gray-200';
  };

  /**
   * Get background color class based on status
   */
  const getStatusBgClass = (status) => {
    if (status === 'completed') return 'bg-green-50';
    if (status === 'failed') return 'bg-red-50';
    if (status === 'skipped') return 'bg-yellow-50';
    return 'bg-gray-50';
  };

  /**
   * Status indicator component
   * Enhanced for mobile with better sizing and spacing
   */
  const StatusIndicator = ({ status }) => {
    if (!status) return null;

    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 bg-green-100 text-green-800 text-xs sm:text-sm font-medium rounded-full">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Completed</span>
        </span>
      );
    }

    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 bg-red-100 text-red-800 text-xs sm:text-sm font-medium rounded-full">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span>Failed</span>
        </span>
      );
    }

    if (status === 'skipped') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 bg-yellow-100 text-yellow-800 text-xs sm:text-sm font-medium rounded-full">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          <span>Skipped</span>
        </span>
      );
    }

    return null;
  };

  /**
   * Status control buttons component
   * Enhanced for mobile with better touch targets and spacing
   */
  const StatusControls = ({ exerciseId, currentStatus }) => {
    const isUpdating = updatingStatus.has(exerciseId);

    return (
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        {/* Mark Completed Button */}
        <button
          onClick={() => handleSetStatus(exerciseId, 'completed')}
          disabled={isUpdating || currentStatus === 'completed'}
          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
            currentStatus === 'completed'
              ? 'bg-green-600 text-white cursor-default'
              : 'bg-green-100 text-green-700 hover:bg-green-200 active:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {currentStatus === 'completed' && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span>{isUpdating ? 'Updating...' : currentStatus === 'completed' ? 'Completed' : 'Mark Complete'}</span>
        </button>

        {/* Mark Failed Button */}
        <button
          onClick={() => handleSetStatus(exerciseId, 'failed')}
          disabled={isUpdating || currentStatus === 'failed'}
          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
            currentStatus === 'failed'
              ? 'bg-red-600 text-white cursor-default'
              : 'bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {currentStatus === 'failed' && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          <span>{isUpdating ? 'Updating...' : currentStatus === 'failed' ? 'Failed' : 'Mark Failed'}</span>
        </button>

        {/* Clear Status Button (only show if status exists) */}
        {currentStatus && (
          <button
            onClick={() => handleClearStatus(exerciseId)}
            disabled={isUpdating}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{isUpdating ? 'Updating...' : 'Clear'}</span>
          </button>
        )}
      </div>
    );
  };

  /**
   * Start a workout for a specific lift
   * Converts the lift's sets into a template format and navigates to ActiveWorkout
   * Uses adjusted weights based on plate availability
   */
  const handleStartWorkout = (lift) => {
    const templateSets = [];
    let setId = 1;

    // Add warmup sets
    if (lift.warmup_sets && lift.warmup_sets.length > 0) {
      lift.warmup_sets.forEach((set, index) => {
        const { weight } = getAdjustedWeightInfo(set.weight);
        templateSets.push({
          id: setId++,
          exercise_id: lift.exercise_id,
          exercise_name: lift.exercise_name,
          set_number: index + 1,
          weight: weight,
          reps: set.reps,
          rpe: null,
          is_warmup: 1
        });
      });
    }

    // For 5/3/1 programs
    if (workout.program_type === '531') {
      // Add main sets (5/3/1 sets) with adjusted weights
      
      if (lift.main_sets) {
        lift.main_sets.forEach((set) => {
          const { weight } = getAdjustedWeightInfo(set.weight);
          templateSets.push({
            id: setId++,
            exercise_id: lift.exercise_id,
            exercise_name: lift.exercise_name,
            set_number: set.set_number,
            weight: weight, // Use adjusted weight
            reps: set.reps,
            rpe: null,
            is_warmup: 0
          });
        });
      }

      // Add BBB accessory sets with adjusted weights
      if (lift.accessory_sets && lift.accessory_sets.length > 0) {
        const bbbSet = lift.accessory_sets[0];
        const { weight } = getAdjustedWeightInfo(bbbSet.weight);
        
        // Add 5 sets of BBB
        for (let i = 0; i < 5; i++) {
          templateSets.push({
            id: setId++,
            exercise_id: lift.exercise_id,
            exercise_name: lift.exercise_name,
            set_number: i + 1,
            weight: weight, // Use adjusted weight
            reps: bbbSet.reps,
            rpe: null,
            is_warmup: 0
          });
        }
      }
    }

    // For Starting Strength programs
    if (workout.program_type === 'starting_strength') {
      if (lift.sets) {
        lift.sets.forEach((set) => {
          const { weight } = getAdjustedWeightInfo(set.weight);
          templateSets.push({
            id: setId++,
            exercise_id: lift.exercise_id,
            exercise_name: lift.exercise_name,
            set_number: set.set_number,
            weight: weight, // Use adjusted weight
            reps: set.reps,
            rpe: null,
            is_warmup: 0
          });
        });
      }
    }

    // Navigate to ActiveWorkout with template sets
    navigate('/workout/active', {
      state: {
        template: {
          name: `${lift.exercise_name} - ${workout.program_type === '531' ? `Week ${workout.week}` : workout.workout_type}`,
          sets: templateSets
        }
      }
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </Layout>
    );
  }

  if (!workout) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No workout available</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              {workout.program_name}
            </h1>
            <button
              onClick={() => navigate('/programs')}
              className="text-blue-600 hover:text-blue-700 active:text-blue-800 text-sm font-medium self-start sm:self-auto"
            >
              ← Back to Programs
            </button>
          </div>
          <div className="text-sm sm:text-base md:text-lg text-gray-600">
            <span className="font-semibold">
              {workout.program_type === '531' ? `Week ${workout.week} · Cycle ${workout.cycle}` : ''}
              {workout.program_type === 'starting_strength' ? `Session ${workout.session_number} · ${workout.workout_type}` : ''}
            </span>
          </div>
        </div>

        {/* Training Max Update Preview for Starting Strength */}
        {workout.lifts && workout.lifts.length > 0 && workout.program_type === 'starting_strength' && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-purple-700 mb-3">
                  {'When you complete this session and advance:'}
                </p>
                
                <div className="space-y-2">
                  {workout.lifts.map((lift, idx) => {
                    const isLowerBody = lift.exercise_name === 'Barbell Squat' || 
                                      lift.exercise_name === 'Barbell Deadlift' || 
                                      lift.exercise_name === 'Power Clean';
                    const increment = isLowerBody ? 10 : 5;
                    const currentMax = lift.current_weight;
                    const isFailed = lift.status === 'failed';
                    const newMax = isFailed ? currentMax - increment : currentMax + increment;
                    const change = isFailed ? -increment : +increment;
                    
                    return (
                      <div key={idx} className="bg-white bg-opacity-60 rounded-lg p-2.5 sm:p-3">
                        {/* Mobile: Stack layout */}
                        <div className="flex flex-col gap-2 sm:hidden">
                          <div className="flex items-start justify-between">
                            <span className="font-medium text-gray-900 text-sm flex-1 min-w-0">{lift.exercise_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isFailed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {change > 0 ? '+' : ''}{change} lbs
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{currentMax} lbs</span>
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-4 h-4 ${isFailed ? 'text-red-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                {isFailed ? (
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                ) : (
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                )}
                              </svg>
                              <span className={`font-bold ${isFailed ? 'text-red-600' : 'text-green-600'}`}>
                                {newMax} lbs
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop: Horizontal layout */}
                        <div className="hidden sm:flex items-center justify-between">
                          <span className="font-medium text-gray-900 text-sm flex-1">{lift.exercise_name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-gray-600 text-sm">{currentMax} lbs</span>
                            <svg className={`w-4 h-4 ${isFailed ? 'text-red-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20">
                              {isFailed ? (
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                              )}
                            </svg>
                            <span className={`font-bold text-sm ${isFailed ? 'text-red-600' : 'text-green-600'}`}>
                              {newMax} lbs
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isFailed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {change > 0 ? '+' : ''}{change} lbs
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {workout.lifts.some(l => l.status === 'failed') && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg p-2.5">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="leading-relaxed">Failed lifts will be <strong>decreased</strong> (deloaded) to allow recovery</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* UPDATED: Training Max Update Preview for 5/3/1 - Only shows on Week 4 */}
        {/* Now checks ALL weeks in the current cycle, not just week 4 */}
        {workout.lifts && workout.lifts.length > 0 && workout.program_type === '531' && workout.week === 4 && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-purple-900 mb-1 sm:mb-2">
                  {'📈 Training Max Updates'}
                </h3>
                <p className="text-xs text-purple-700 mb-3">
                  {'After completing this deload week:'}
                </p>
                
                {loadingStatuses ? (
                  <div className="text-xs sm:text-sm text-purple-600">Loading status data...</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {workout.lifts.map((lift, idx) => {
                        const isLowerBody = lift.exercise_name === 'Barbell Squat' || 
                                          lift.exercise_name === 'Barbell Deadlift' || 
                                          lift.exercise_name === 'Power Clean';
                        const increment = isLowerBody ? 10 : 5;
                        const currentMax = lift.training_max;
                        
                        // UPDATED: Check if failed in ANY week of the cycle, not just current week
                        const isFailed = hasFailureInCycle(lift.exercise_id);
                        const failedWeeks = getFailedWeeks(lift.exercise_id);
                        
                        const newMax = isFailed ? currentMax - increment : currentMax + increment;
                        const change = isFailed ? -increment : +increment;
                        
                        return (
                          <div key={idx} className="bg-white bg-opacity-60 rounded-lg p-2.5 sm:p-3">
                            {/* Mobile: Stack layout */}
                            <div className="flex flex-col gap-2 sm:hidden">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 text-sm truncate">{lift.exercise_name}</div>
                                  {isFailed && failedWeeks.length > 0 && (
                                    <div className="text-xs text-red-600 mt-0.5">
                                      Week{failedWeeks.length > 1 ? 's' : ''} {failedWeeks.join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isFailed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {change > 0 ? '+' : ''}{change} lbs
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{currentMax} lbs</span>
                                <div className="flex items-center gap-1.5">
                                  <svg className={`w-4 h-4 ${isFailed ? 'text-red-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                    {isFailed ? (
                                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    ) : (
                                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                    )}
                                  </svg>
                                  <span className={`font-bold ${isFailed ? 'text-red-600' : 'text-green-600'}`}>
                                    {newMax} lbs
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Desktop: Horizontal layout */}
                            <div className="hidden sm:flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-900 text-sm">{lift.exercise_name}</span>
                                {isFailed && failedWeeks.length > 0 && (
                                  <div className="text-xs text-red-600 mt-0.5">
                                    Failed in week{failedWeeks.length > 1 ? 's' : ''}: {failedWeeks.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-gray-600 text-sm">{currentMax} lbs</span>
                                <svg className={`w-4 h-4 ${isFailed ? 'text-red-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                  {isFailed ? (
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  ) : (
                                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                  )}
                                </svg>
                                <span className={`font-bold text-sm ${isFailed ? 'text-red-600' : 'text-green-600'}`}>
                                  {newMax} lbs
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${isFailed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {change > 0 ? '+' : ''}{change} lbs
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* UPDATED: Show warning if ANY week in the cycle had failures */}
                    {workout.lifts.some(lift => hasFailureInCycle(lift.exercise_id)) && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg p-2.5">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="leading-relaxed">Lifts with failures in ANY week of this cycle will be <strong>decreased</strong> to allow recovery</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Display */}
        {message.text && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Advance Week Button */}
        <div className="mb-6">
          {/* Warning for failed lifts */}
          {workout.lifts && workout.lifts.some(lift => lift.status === 'failed') && (
            <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-yellow-800 mb-1">
                    ⚠️ Failed lifts detected
                  </p>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    When you advance, training max will be <strong>decreased</strong> for: {' '}
                    <span className="font-medium">{workout.lifts.filter(l => l.status === 'failed').map(l => l.exercise_name).join(', ')}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={handleCompleteWeek}
            disabled={advancing}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
          >
            {advancing ? 'Advancing...' : 'Complete Week & Advance'}
          </button>
        </div>

        {/* Starting Strength Auto-Progression Notice */}
        {workout.program_type === 'starting_strength' && (
          <div className="mb-4 sm:mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-700">
              Weights will automatically increase after you complete this session
            </p>
          </div>
        )}

        {/* Lifts */}
        <div className="space-y-6">
          {workout.lifts && workout.lifts.map((lift, liftIndex) => (
            <div 
              key={liftIndex} 
              className={`bg-white border rounded-lg overflow-hidden transition-all ${getStatusBorderClass(lift.status)}`}
            >
              {/* Lift Header */}
              <div
                className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 ${!isLiftCollapsed(lift.exercise_id) ? 'border-b border-gray-200' : ''} ${getStatusBgClass(lift.status)} ${(lift.status === 'completed' || lift.status === 'failed') ? 'cursor-pointer' : ''}`}
                onClick={(lift.status === 'completed' || lift.status === 'failed') ? () => toggleLiftCollapse(lift.exercise_id) : undefined}
              >
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  {/* Exercise Name and Status Row */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">{lift.exercise_name}</h2>
                        {/* Collapse/Expand indicator for completed/failed lifts */}
                        {(lift.status === 'completed' || lift.status === 'failed') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLiftCollapse(lift.exercise_id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                            aria-label={isLiftCollapsed(lift.exercise_id) ? 'Expand workout details' : 'Collapse workout details'}
                          >
                            <svg
                              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isLiftCollapsed(lift.exercise_id) ? '' : 'rotate-180'}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <StatusIndicator status={lift.status} />
                    </div>
                    {/* Start Workout Button - hidden when collapsed */}
                    {!isLiftCollapsed(lift.exercise_id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartWorkout(lift);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm whitespace-nowrap min-h-[44px] sm:min-h-0"
                      >
                        Start Workout
                      </button>
                    )}
                  </div>

                  {/* Training Max / Current Weight */}
                  <p className="text-xs sm:text-sm text-gray-600">
                    {workout.program_type === '531' && `Training Max: ${lift.training_max} lbs`}
                    {workout.program_type === 'starting_strength' && `Current Weight: ${lift.current_weight} lbs`}
                  </p>

                  {/* Status Controls - hidden when collapsed */}
                  {!isLiftCollapsed(lift.exercise_id) && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusControls exerciseId={lift.exercise_id} currentStatus={lift.status} />
                    </div>
                  )}

                  {/* Collapsed summary - show tap to expand hint */}
                  {isLiftCollapsed(lift.exercise_id) && (
                    <p className="text-xs text-gray-500 italic">
                      Tap to expand workout details
                    </p>
                  )}
                </div>
              </div>

              {/* 5/3/1 Program Content - Hidden when collapsed */}
              {workout.program_type === '531' && !isLiftCollapsed(lift.exercise_id) && (
                <>
                  {/* Warmup Sets */}
                  {lift.warmup_sets && lift.warmup_sets.length > 0 && (
                    <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Warmup Sets</h3>
                      <div className="space-y-3">
                        {lift.warmup_sets.map((set, setIndex) => (
                          <div key={setIndex} className="border border-gray-300 rounded-lg p-3 sm:p-4 bg-white">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-base sm:text-lg font-bold text-gray-700">
                                  Warmup {setIndex + 1}:
                                </span>
                                {/* Use WeightDisplay to show plate-adjusted weights */}
                                <WeightDisplay programmedWeight={set.weight} className="text-gray-700" />
                                <span className="text-sm sm:text-base text-gray-600">
                                  × {set.reps} reps
                                </span>
                              </div>
                            </div>
                            {/* Plate Calculator */}
                            <PlateCalculator targetWeight={set.weight} />
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs sm:text-sm text-gray-600">
                        <strong>💡 Tip:</strong> Warmup sets prepare your muscles and nervous system. Rest 30-60 seconds between warmup sets.
                      </p>
                    </div>
                  )}

                  {/* Main Sets */}
                  <div className="p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Main Sets (5/3/1)</h3>
                    <div className="space-y-4">
                      {lift.main_sets && lift.main_sets.map((set, setIndex) => (
                        <div key={setIndex} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-base sm:text-lg font-bold text-gray-900">
                                Set {set.set_number}:
                              </span>
                              <WeightDisplay programmedWeight={set.weight} />
                              <span className="text-sm sm:text-base text-gray-600">
                                × {set.reps}{set.is_amrap ? '+' : ''} reps
                              </span>
                              <span className="text-xs sm:text-sm text-gray-500">
                                ({set.percentage}% TM)
                              </span>
                            </div>
                            {set.is_amrap && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded self-start">
                                AMRAP
                              </span>
                            )}
                          </div>
                          {/* Plate Calculator */}
                          <PlateCalculator targetWeight={set.weight} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BBB Accessory Sets */}
                  {lift.accessory_sets && lift.accessory_sets.length > 0 && (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        Boring But Big (BBB) Accessory
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                        <div className="mb-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-base sm:text-lg font-bold text-gray-900">
                              5 sets:
                            </span>
                            <WeightDisplay programmedWeight={lift.accessory_sets[0].weight} />
                            <span className="text-sm sm:text-base text-gray-600">
                              × {lift.accessory_sets[0].reps} reps
                            </span>
                            <span className="text-xs sm:text-sm text-gray-500">
                              ({lift.accessory_sets[0].percentage}% TM)
                            </span>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-3">
                          Same weight for all 5 sets. Rest 1-2 minutes between sets.
                        </p>
                        {/* Plate Calculator */}
                        <PlateCalculator targetWeight={lift.accessory_sets[0].weight} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Starting Strength Program Content - Hidden when collapsed */}
              {workout.program_type === 'starting_strength' && lift.sets && !isLiftCollapsed(lift.exercise_id) && (
                <>
                  {/* Warmup Sets */}
                  {lift.warmup_sets && lift.warmup_sets.length > 0 && (
                    <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Warmup Sets</h3>
                      <div className="space-y-3">
                        {lift.warmup_sets.map((set, setIndex) => (
                          <div key={setIndex} className="border border-gray-300 rounded-lg p-3 sm:p-4 bg-white">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-base sm:text-lg font-bold text-gray-700">
                                  Warmup {setIndex + 1}:
                                </span>
                                {/* Use WeightDisplay to show plate-adjusted weights */}
                                <WeightDisplay programmedWeight={set.weight} className="text-gray-700" />
                                <span className="text-sm sm:text-base text-gray-600">
                                  × {set.reps} reps
                                </span>
                              </div>
                            </div>
                            {/* Plate Calculator */}
                            <PlateCalculator targetWeight={set.weight} />
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs sm:text-sm text-gray-600">
                        <strong>💡 Tip:</strong> Warmup sets prepare your muscles and nervous system. Rest 30-60 seconds between warmup sets.
                      </p>
                    </div>
                  )}

                  {/* Working Sets */}
                  <div className="p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                      Working Sets
                    </h3>
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                      <div className="mb-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-base sm:text-lg font-bold text-gray-900">
                            {lift.sets.length} × {lift.sets[0].reps}:
                          </span>
                          <WeightDisplay programmedWeight={lift.sets[0].weight} />
                          <span className="text-sm text-gray-600">
                            ({lift.sets.length} sets of {lift.sets[0].reps} reps)
                          </span>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3">
                        Same weight for all sets. Rest 3-5 minutes between sets.
                      </p>
                      {/* Plate Calculator */}
                      <PlateCalculator targetWeight={lift.sets[0].weight} />
                    </div>
                    
                    {/* Next Session Info */}
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs sm:text-sm text-green-800">
                        <strong>Next session:</strong> {' '}
                        {lift.exercise_name === 'Barbell Squat' || lift.exercise_name === 'Barbell Deadlift' 
                          ? `${lift.sets[0].weight + 10} lbs (+10 lbs)`
                          : `${lift.sets[0].weight + 5} lbs (+5 lbs)`
                        }
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Training Notes */}
        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 md:p-6">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-blue-900 mb-2 sm:mb-3">💡 Training Notes</h3>
          
          {/* 5/3/1 Notes */}
          {workout.program_type === '531' && (
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-blue-800">
              {workout.week !== 4 ? (
                <>
                  <li>• <strong>AMRAP sets:</strong> Push for as many quality reps as possible</li>
                  <li>• <strong>Main sets:</strong> Rest 3-5 minutes between sets</li>
                  <li>• <strong>BBB sets:</strong> Rest 1-2 minutes, focus on form and volume</li>
                  <li>• <strong>Week {workout.week} target:</strong> {workout.week === 1 ? '8-10+ reps on AMRAP' : workout.week === 2 ? '5-7+ reps on AMRAP' : '3-5+ reps on AMRAP'}</li>
                  <li>• <strong>Mark failed:</strong> If you miss the AMRAP target or complete fewer reps than prescribed</li>
                </>
              ) : (
                <>
                  <li>• <strong>Deload week:</strong> Focus on recovery, not max effort</li>
                  <li>• <strong>Purpose:</strong> Allows body to recover before next cycle</li>
                  <li>• <strong>Next week:</strong> Cycle {workout.cycle + 1} begins!</li>
                  <li>• <strong>Training max adjustments:</strong> Based on performance across ALL weeks of this cycle</li>
                </>
              )}
            </ul>
          )}
          
          {/* Starting Strength Notes */}
          {workout.program_type === 'starting_strength' && (
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-blue-800">
              <li>• <strong>Linear Progression:</strong> Add weight every session - program does this automatically</li>
              <li>• <strong>Rest periods:</strong> 3-5 minutes between sets for best recovery</li>
              <li>• <strong>Form first:</strong> Only increase weight if you can maintain good form for all reps</li>
              <li>• <strong>Warmup:</strong> Always start with empty bar and work up to working weight</li>
              <li>• <strong>Frequency:</strong> Train 3x per week (e.g., Monday, Wednesday, Friday)</li>
              <li>• <strong>Progression:</strong> Squat/Deadlift +10 lbs · Bench/Press +5 lbs per session</li>
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CurrentWeek;