import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { programsAPI } from '../services/api';
import PlateCalculator from '../components/PlateCalculator/PlateCalculator';
import Layout from '../components/Layout/Layout';

const CurrentWeek = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{workout.program_name}</h1>
              <p className="mt-2 text-gray-600">
                Week {workout.week} ({getWeekName(workout.week)}) · Cycle {workout.cycle}
              </p>
            </div>
            <button
              onClick={handleCompleteWeek}
              disabled={advancing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {advancing ? 'Advancing...' : 'Complete Week'}
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
        {workout.week === 4 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 font-medium">
              🔄 Deload Week - Recovery and preparation for next cycle
            </p>
          </div>
        )}

        {/* Lifts */}
        <div className="space-y-6">
          {workout.lifts && workout.lifts.map((lift, liftIndex) => (
            <div key={liftIndex} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Lift Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">{lift.exercise_name}</h2>
                <p className="text-sm text-gray-600">Training Max: {lift.training_max} lbs</p>
              </div>

              {/* Main Sets */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Sets (5/3/1)</h3>
                <div className="space-y-4">
                  {lift.main_sets && lift.main_sets.map((set, setIndex) => (
                    <div key={setIndex} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-lg font-bold text-gray-900">
                            Set {set.set_number}:{' '}
                          </span>
                          <span className="text-lg font-bold text-blue-600">
                            {set.weight} lbs
                          </span>
                          <span className="text-gray-600 ml-2">
                            × {set.reps}{set.is_amrap ? '+' : ''} reps
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({set.percentage}% TM)
                          </span>
                        </div>
                        {set.is_amrap && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
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
                <div className="px-6 pb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Boring But Big (BBB) Accessory
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-lg font-bold text-gray-900">
                          5 sets:{' '}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {lift.accessory_sets[0].weight} lbs
                        </span>
                        <span className="text-gray-600 ml-2">
                          × {lift.accessory_sets[0].reps} reps
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({lift.accessory_sets[0].percentage}% TM)
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Same weight for all 5 sets. Rest 1-2 minutes between sets.
                    </p>
                    {/* Plate Calculator */}
                    <PlateCalculator targetWeight={lift.accessory_sets[0].weight} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Training Notes */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Training Notes</h3>
          <ul className="space-y-2 text-sm text-blue-800">
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
        </div>
      </div>
    </Layout>
  );
};

export default CurrentWeek;