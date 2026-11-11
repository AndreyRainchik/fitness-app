import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation, useBeforeUnload } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutTimer from '../components/Timers/WorkoutTimer';
import RestTimer from '../components/Timers/RestTimer';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { Button, useConfirm } from '../components/ui';
import { getLocalDateString } from '../utils/dateUtils';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

const REST_SECONDS = 180;

function ActiveWorkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();

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
    const confirmed = await confirm({
      title: 'Finish workout?',
      message: `${name}\nDuration: ${minutes} min · ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`,
      confirmLabel: 'Finish & Save',
      cancelLabel: 'Keep going'
    });
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

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: 'Discard this workout?',
      message: 'Nothing from this session will be saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep going',
      tone: 'danger'
    });
    if (confirmed) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <Layout>
      {/* Sticky header with timer and controls */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg mb-6 -mx-4 px-4 py-6 md:-mx-6 md:px-6">
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
                type="button"
                onClick={() => setIsTimerRunning((running) => !running)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors text-white ${
                  isTimerRunning ? 'bg-warning-500 hover:bg-warning-600' : 'bg-success-500 hover:bg-success-600'
                }`}
              >
                {isTimerRunning ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white rounded-lg font-semibold transition-colors"
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
            <Button
              variant="secondary"
              onClick={() => setIsRestTimerActive(true)}
              disabled={disabled}
              title="Start rest timer (3:00)"
              aria-label="Start rest timer"
            >
              <span aria-hidden="true">⏱️</span>
              <span className="hidden sm:inline">Start Rest</span>
            </Button>
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
