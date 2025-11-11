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

  // Collect all weights from workout for batch fetching
  const allWeights = useMemo(() => {
    if (!workout || !workout.lifts) return [];
    
    const weights = [];
    workout.lifts.forEach(lift => {
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

  useEffect(() => {
    if (programId) {
      loadCurrentWeek();
    } else {
      loadActiveProgram();
    }
  }, [programId]);

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
   */
  const StatusIndicator = ({ status }) => {
    if (!status) return null;

    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Completed
        </span>
      );
    }

    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Failed
        </span>
      );
    }

    if (status === 'skipped') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Skipped
        </span>
      );
    }

    return null;
  };

  /**
   * Status control buttons component
   */
  const StatusControls = ({ exerciseId, currentStatus }) => {
    const isUpdating = updatingStatus.has(exerciseId);

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {/* Mark Completed Button */}
        <button
          onClick={() => handleSetStatus(exerciseId, 'completed')}
          disabled={isUpdating || currentStatus === 'completed'}
          className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentStatus === 'completed'
              ? 'bg-green-600 text-white cursor-default'
              : 'bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isUpdating ? 'Updating...' : currentStatus === 'completed' ? '✓ Completed' : 'Mark Complete'}
        </button>

        {/* Mark Failed Button */}
        <button
          onClick={() => handleSetStatus(exerciseId, 'failed')}
          disabled={isUpdating || currentStatus === 'failed'}
          className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentStatus === 'failed'
              ? 'bg-red-600 text-white cursor-default'
              : 'bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isUpdating ? 'Updating...' : currentStatus === 'failed' ? '✗ Failed' : 'Mark Failed'}
        </button>

        {/* Clear Status Button (only show if status exists) */}
        {currentStatus && (
          <button
            onClick={() => handleClearStatus(exerciseId)}
            disabled={isUpdating}
            className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Clear'}
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
            set_number: lift.main_sets.length + i + 1,
            weight: weight, // Use adjusted weight
            reps: bbbSet.reps,
            rpe: null,
            is_warmup: 0
          });
        }
      }
    }
    
    // For Starting Strength programs
    else if (workout.program_type === 'starting_strength') {
      if (lift.sets && lift.sets.length > 0) {
        const { weight } = getAdjustedWeightInfo(lift.sets[0].weight);
        
        lift.sets.forEach((set) => {
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

    // Navigate to active workout with pre-populated sets
    navigate('/workout/active', {
      state: {
        fromProgram: true,
        programId: workout.program_id,
        sets: templateSets
      }
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading workout...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Helper function to format program type for display
  const formatProgramType = (type) => {
    if (type === '531') return '5/3/1';
    if (type === 'starting_strength') return 'Starting Strength';
    if (type === 'custom') return 'Custom';
    return type;
  };

  if (!workout) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No workout found. Please create a program first.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        {/* Messages */}
        {message.text && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {workout.program_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-gray-600">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm">
              {formatProgramType(workout.program_type)}
            </span>
            <span className="font-semibold">
              {workout.program_type === '531' ? `Week ${workout.week} · Cycle ${workout.cycle}` : ''}
              {workout.program_type === 'starting_strength' ? `Session ${workout.session_number} · ${workout.workout_type}` : ''}
            </span>
          </div>
        </div>

        {/* Advance Week Button */}
        <div className="mb-6">
          {/* Warning for failed lifts */}
          {workout.lifts && workout.lifts.some(lift => lift.status === 'failed') && (
            <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">
                    ⚠️ Failed lifts detected
                  </p>
                  <p className="text-xs text-yellow-700">
                    When you advance, training max will be <strong>decreased</strong> for: {' '}
                    {workout.lifts.filter(l => l.status === 'failed').map(l => l.exercise_name).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={handleCompleteWeek}
            disabled={advancing}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {advancing ? 'Advancing...' : 'Complete Week & Advance'}
          </button>
        </div>

        {/* Starting Strength Auto-Progression Notice */}
        {workout.program_type === 'starting_strength' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mt-1">
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
              <div className={`px-4 sm:px-6 py-4 border-b border-gray-200 ${getStatusBgClass(lift.status)}`}>
                <div className="flex flex-col gap-3">
                  {/* Exercise Name and Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{lift.exercise_name}</h2>
                      <StatusIndicator status={lift.status} />
                    </div>
                    {/* Start Workout Button */}
                    <button
                      onClick={() => handleStartWorkout(lift)}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                    >
                      Start Workout
                    </button>
                  </div>
                  
                  {/* Training Max / Current Weight */}
                  <p className="text-sm text-gray-600">
                    {workout.program_type === '531' && `Training Max: ${lift.training_max} lbs`}
                    {workout.program_type === 'starting_strength' && `Current Weight: ${lift.current_weight} lbs`}
                  </p>

                  {/* Status Controls */}
                  <StatusControls exerciseId={lift.exercise_id} currentStatus={lift.status} />
                </div>
              </div>

              {/* 5/3/1 Program Content */}
              {workout.program_type === '531' && (
                <>
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

              {/* Starting Strength Program Content */}
              {workout.program_type === 'starting_strength' && lift.sets && (
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
              )}
            </div>
          ))}
        </div>

        {/* Training Notes */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-3">💡 Training Notes</h3>
          
          {/* 5/3/1 Notes */}
          {workout.program_type === '531' && (
            <ul className="space-y-2 text-xs sm:text-sm text-blue-800">
              {workout.week !== 4 ? (
                <>
                  <li>• <strong>AMRAP sets:</strong> Push for as many quality reps as possible</li>
                  <li>• <strong>Main sets:</strong> Rest 3-5 minutes between sets</li>
                  <li>• <strong>BBB sets:</strong> Rest 1-2 minutes, focus on form and volume</li>
                  <li>• <strong>Week {workout.week} target:</strong> {workout.week === 1 ? '8-10+ reps on AMRAP' : workout.week === 2 ? '5-7+ reps on AMRAP' : '3-5+ reps on AMRAP'}</li>
                </>
              ) : (
                <>
                  <li>• <strong>Deload week:</strong> Focus on recovery, not max effort</li>
                  <li>• <strong>Purpose:</strong> Allows body to recover before next cycle</li>
                  <li>• <strong>Next week:</strong> Cycle {workout.cycle + 1} begins!</li>
                </>
              )}
            </ul>
          )}
          
          {/* Starting Strength Notes */}
          {workout.program_type === 'starting_strength' && (
            <ul className="space-y-2 text-xs sm:text-sm text-blue-800">
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