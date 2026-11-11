import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation, useBeforeUnload } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutTimer from '../components/Timers/WorkoutTimer';
import RestTimer from '../components/Timers/RestTimer';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { getLocalDateString } from '../utils/dateUtils';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

const REST_SECONDS = 180;

function ActiveWorkout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Templates and program days arrive as location.state.template = { name, sets }
  const [initialValues] = useState(() => {
    const template = location.state?.template;
    return {
      name: template?.name || '',
      date: getLocalDateString(),
      notes: '',
      exercises: setsToExerciseBlocks(template?.sets)
    };
  });

  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);

  // Warn before closing or reloading the tab mid-workout
  useBeforeUnload(
    useCallback((e) => {
      e.preventDefault();
      e.returnValue = '';
    }, [])
  );

  const handleFinish = async ({ name, date, notes, exercises, sets }) => {
    const minutes = Math.floor(totalSeconds / 60);
    const confirmed = window.confirm(
      `Finish workout "${name}"?\n\nDuration: ${minutes} minutes\nExercises: ${exercises.length}`
    );
    if (!confirmed) return false;

    const workout = await workoutsAPI.create({
      name,
      date,
      duration_minutes: minutes,
      ...(notes ? { notes } : {}),
      sets
    });
    navigate(`/workout/${workout.workout.id}`, { replace: true });
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this workout? All progress will be lost.')) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <Layout>
      {/* Sticky header with timer and controls */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg mb-6 -mx-4 px-4 py-6 md:-mx-6 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white">Active Workout</h1>
              {location.state?.fromTemplate && (
                <span className="hidden sm:inline px-3 py-1 bg-white bg-opacity-20 text-white text-sm font-medium rounded-full">
                  📋 From Template
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setIsTimerRunning((running) => !running)}
                className={`px-4 py-2 rounded-lg font-semibold transition duration-200 text-white ${
                  isTimerRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isTimerRunning ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition duration-200"
              >
                ❌ Cancel
              </button>
            </div>
          </div>

          <WorkoutTimer isRunning={isTimerRunning} onTimeUpdate={setTotalSeconds} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-6">
        <WorkoutEditor
          initialValues={initialValues}
          onSubmit={handleFinish}
          onCancel={handleCancel}
          submitLabel="✅ Finish Workout"
          namePlaceholder="e.g., Push Day, Leg Day"
          onSetAdded={() => setIsRestTimerActive(true)}
          renderExerciseActions={(_exercise, { disabled }) => (
            <button
              type="button"
              onClick={() => setIsRestTimerActive(true)}
              disabled={disabled}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              title="Start rest timer (3:00)"
            >
              <span className="text-base">⏱️</span>
              <span className="hidden sm:inline">Start Rest</span>
            </button>
          )}
        />
      </div>

      <RestTimer
        duration={REST_SECONDS}
        isActive={isRestTimerActive}
        onComplete={() => setIsRestTimerActive(false)}
        onSkip={() => setIsRestTimerActive(false)}
      />
    </Layout>
  );
}

export default ActiveWorkout;
