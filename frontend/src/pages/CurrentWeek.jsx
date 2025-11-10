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
    if (!confirm('Mark this week as complete and advance to next week?')) {
      return;
    }

    try {
      setAdvancing(true);
      await programsAPI.advanceWeek(workout.program_id);
      setMessage({ type: 'success', text: 'Advanced to next week!' });
      
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
        
        for (let i = 1; i <= 5; i++) {
          templateSets.push({
            id: setId++,
            exercise_id: lift.exercise_id,
            exercise_name: lift.exercise_name,
            set_number: lift.main_sets.length + i,
            weight: weight,
            reps: bbbSet.reps,
            rpe: null,
            is_warmup: 0
          });
        }
      }
    }

    // For Starting Strength programs
    if (workout.program_type === 'starting_strength') {
      // Add working sets with adjusted weights
      if (lift.sets) {
        const { weight } = getAdjustedWeightInfo(lift.sets[0].weight);
        
        lift.sets.forEach((set) => {
          templateSets.push({
            id: setId++,
            exercise_id: lift.exercise_id,
            exercise_name: lift.exercise_name,
            set_number: set.set_number,
            weight: weight,
            reps: set.reps,
            rpe: null,
            is_warmup: 0
          });
        });
      }
    }

    // Create template object
    const template = {
      name: workout.program_type === '531' 
        ? `${lift.exercise_name} - Week ${workout.week}`
        : `${lift.exercise_name} - ${workout.workout_type}`,
      sets: templateSets
    };

    // Navigate to ActiveWorkout with pre-populated data
    navigate('/workout/active', { state: { template } });
  };

  const getWeekName = (week) => {
    const names = {
      1: '5/5/5+',
      2: '3/3/3+',
      3: '5/3/1+',
      4: 'Deload'
    };
    return names[week] || `Week ${week}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!workout) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 mb-4">No active program found</p>
            <button
              onClick={() => navigate('/programs')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Programs
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{workout.program_name}</h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                {workout.program_type === '531' && (
                  <>Week {workout.week} ({getWeekName(workout.week)}) · Cycle {workout.cycle}</>
                )}
                {workout.program_type === 'starting_strength' && (
                  <>{workout.workout_type} · Session {workout.session_number}</>
                )}
              </p>
            </div>
            <button
              onClick={handleCompleteWeek}
              disabled={advancing}
              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {advancing ? 'Advancing...' : workout.program_type === 'starting_strength' ? 'Complete Session' : 'Complete Week'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Week Info */}
        {workout.program_type === '531' && workout.week === 4 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 font-medium">
              🔄 Deload Week - Recovery and preparation for next cycle
            </p>
          </div>
        )}
        
        {workout.program_type === 'starting_strength' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 font-medium">
              💪 {workout.workout_type} - Linear Progression
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Weights will automatically increase after you complete this session
            </p>
          </div>
        )}

        {/* Lifts */}
        <div className="space-y-6">
          {workout.lifts && workout.lifts.map((lift, liftIndex) => (
            <div key={liftIndex} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Lift Header */}
              <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{lift.exercise_name}</h2>
                    <p className="text-sm text-gray-600">
                      {workout.program_type === '531' && `Training Max: ${lift.training_max} lbs`}
                      {workout.program_type === 'starting_strength' && `Current Weight: ${lift.current_weight} lbs`}
                    </p>
                  </div>
                  {/* Start Workout Button */}
                  <button
                    onClick={() => handleStartWorkout(lift)}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                  >
                    Start Workout
                  </button>
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