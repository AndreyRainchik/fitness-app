import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { programsAPI } from '../services/api';
import ProgramSetRow from '../components/Program/ProgramSetRow';
import { CalendarCheck, Check, ChevronDown, Play, RotateCcw, X } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import { useBatchPlateAdjustedWeights } from '../utils/usePlateAdjustedWeight';
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader, useConfirm } from '../components/ui';

// Per-lift training max adjustment choices shown on the week 4 preview.
// `delta(increment)` returns the change in lbs for the given lift increment.
const ADJUSTMENT_OPTIONS = [
  { value: 'increment_2x', label: 'Increase 2x', delta: (inc) => inc * 2, text: 'text-primary-600', badge: 'bg-primary-100 text-primary-700' },
  { value: 'increment_1x', label: 'Increase 1x', delta: (inc) => inc, text: 'text-success-600', badge: 'bg-success-100 text-success-700' },
  { value: 'keep', label: 'Keep the same', delta: () => 0, text: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' },
  { value: 'decrement_1x', label: 'Decrease 1x', delta: (inc) => -inc, text: 'text-danger-600', badge: 'bg-danger-100 text-danger-700' },
];

const getAdjustmentOption = (value) =>
  ADJUSTMENT_OPTIONS.find(opt => opt.value === value) || ADJUSTMENT_OPTIONS[1];

// Preview of what a given week 3 (1-rep week) AMRAP rep count means for next cycle.
// Returns a label + tailwind classes, or null if reps aren't a positive number.
const getWeek3OutcomeBadge = (reps) => {
  if (reps === null || reps === undefined || isNaN(reps)) return null;
  if (reps >= 11) return { label: '2x increment next cycle!', classes: 'text-primary-700 bg-primary-100' };
  if (reps >= 5) return { label: '1x increment next cycle', classes: 'text-success-700 bg-success-100' };
  if (reps >= 1) return { label: 'Training max stays the same', classes: 'text-gray-700 bg-gray-100' };
  return { label: 'Training max will decrease', classes: 'text-danger-700 bg-danger-100' };
};

const CurrentWeek = () => {
  const confirm = useConfirm();
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

  // State for tracking AMRAP reps input per exercise (exerciseId -> rep count string)
  const [amrapRepsInput, setAmrapRepsInput] = useState({});

  // State for week 4 per-lift training max adjustment overrides.
  // Map of exercise_id -> adjustment choice (increment_2x | increment_1x | keep | decrement_1x).
  // Only lifts the user explicitly overrode are present; others use the suggested default.
  const [adjustmentOverrides, setAdjustmentOverrides] = useState({});

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
  const WeightDisplay = ({ programmedWeight }) => {
    const { weight, isAdjusted } = getAdjustedWeightInfo(programmedWeight);
    return (
      <span
        className={`tabular text-[15px] font-semibold ${isAdjusted ? 'text-warning-700' : 'text-gray-900'}`}
        title={isAdjusted ? `Rounded from ${programmedWeight} lbs to match your plates` : undefined}
      >
        {isAdjusted && <span className="mr-0.5" aria-label="approximately">≈</span>}
        {weight}
        <span className="ml-0.5 text-xs font-medium text-gray-500">lbs</span>
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

  // Get the recorded week 3 (1-rep week) AMRAP reps for an exercise, or null if none
  const getWeek3AmrapReps = (exerciseId) => {
    if (!allStatuses || !workout) return null;
    const status = allStatuses.statuses.find(
      s =>
        s.exercise_id === exerciseId &&
        s.cycle === workout.cycle &&
        s.week === 3
    );
    if (status && status.amrap_reps !== null && status.amrap_reps !== undefined) {
      return status.amrap_reps;
    }
    return null;
  };

  // Determine the suggested training max adjustment based on this cycle's performance.
  // Mirrors the backend logic in Program.getDefault531Adjustment().
  //   11+ week 3 AMRAP reps -> increment_2x
  //   5-10 reps             -> increment_1x
  //   1-4 reps             -> keep
  //   0 reps or a failure  -> decrement_1x
  //   no reps recorded     -> increment_1x (progress normally)
  const getDefaultAdjustment = (exerciseId) => {
    if (hasFailureInCycle(exerciseId)) return 'decrement_1x';
    const reps = getWeek3AmrapReps(exerciseId);
    if (reps === null) return 'increment_1x';
    if (reps >= 11) return 'increment_2x';
    if (reps >= 5) return 'increment_1x';
    if (reps >= 1) return 'keep';
    return 'decrement_1x';
  };

  // The effective adjustment for a lift: the user's override if set, else the suggestion
  const getEffectiveAdjustment = (exerciseId) => {
    if (Object.prototype.hasOwnProperty.call(adjustmentOverrides, exerciseId)) {
      return adjustmentOverrides[exerciseId];
    }
    return getDefaultAdjustment(exerciseId);
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
    
    let confirmMessage = 'This moves the program on to the next week.';

    if (failedLifts.length > 0) {
      const liftNames = failedLifts.map(lift => lift.exercise_name).join(', ');
      confirmMessage = `You have ${failedLifts.length} failed lift(s): ${liftNames}\n\n` +
        'Their training max/weight will be decreased by the increment amount.';
    }

    const confirmed = await confirm({
      title: 'Complete this week?',
      message: confirmMessage,
      confirmLabel: 'Complete Week',
      tone: failedLifts.length > 0 ? 'danger' : 'primary'
    });
    if (!confirmed) return;

    try {
      setAdvancing(true);
      await programsAPI.advanceWeek(workout.program_id, adjustmentOverrides);
      
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
   * @param {number} exerciseId
   * @param {string} status
   * @param {number|null} amrapReps - Reps achieved on the AMRAP set (for weeks 1-3)
   */
  const handleSetStatus = async (exerciseId, status, amrapReps = null) => {
    try {
      // Add to updating set
      setUpdatingStatus(prev => new Set(prev).add(exerciseId));

      await programsAPI.setLiftStatus(workout.program_id, exerciseId, status, null, amrapReps);

      // Clear the AMRAP reps input for this exercise after saving
      setAmrapRepsInput(prev => {
        const updated = { ...prev };
        delete updated[exerciseId];
        return updated;
      });

      // Auto-collapse if marking as completed or failed
      if (status === 'completed' || status === 'failed') {
        setCollapsedLifts(prev => new Set(prev).add(exerciseId));
      }

      // Reload workout and all statuses to get updated state
      if (programId) {
        await loadCurrentWeek();
      } else {
        await loadActiveProgram();
      }
      // Refresh all statuses so Week 4 preview reflects the latest AMRAP reps
      if (workout && workout.program_id && workout.program_type === '531') {
        loadAllStatuses(workout.program_id);
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

      // Reload workout and all statuses to get updated state
      if (programId) {
        await loadCurrentWeek();
      } else {
        await loadActiveProgram();
      }
      if (workout && workout.program_id && workout.program_type === '531') {
        loadAllStatuses(workout.program_id);
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
   * Status indicator component
   * Enhanced for mobile with better sizing and spacing
   */
  const StatusIndicator = ({ status }) => {
    if (!status) return null;

    if (status === 'completed') {
      return (
        <span className="hidden items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-800 sm:inline-flex">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Completed</span>
        </span>
      );
    }

    if (status === 'failed') {
      return (
        <span className="hidden items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-xs font-semibold text-danger-800 sm:inline-flex">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span>Failed</span>
        </span>
      );
    }

    if (status === 'skipped') {
      return (
        <span className="hidden items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 sm:inline-flex">
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
  // NOTE: This is intentionally invoked as a regular function (not as a JSX
  // component element) at the call site below. Defining a component inside the
  // parent's render would give it a new identity on every render of
  // CurrentWeek, causing React to unmount/remount the subtree on every
  // keystroke — which makes the AMRAP <input> lose focus mid-typing.
  const renderStatusControls = ({ exerciseId, currentStatus, recordedAmrapReps }) => {
    const isUpdating = updatingStatus.has(exerciseId);
    // AMRAP input is only relevant for 5/3/1 weeks 1-3 (weeks with an AMRAP set)
    const isAmrapWeek = workout && workout.program_type === '531' && workout.week >= 1 && workout.week <= 3;
    const isWeek3 = workout && workout.week === 3;
    const inputReps = amrapRepsInput[exerciseId] || '';
    const parsedInputReps = parseInt(inputReps, 10);
    const inputOutcomeBadge = isWeek3 && inputReps !== '' ? getWeek3OutcomeBadge(parsedInputReps) : null;
    const recordedOutcomeBadge = isWeek3 ? getWeek3OutcomeBadge(recordedAmrapReps) : null;
    const amrapInputId = `amrap-${exerciseId}`;

    return (
      <div className="space-y-3">
        <p className="eyebrow">After your session</p>

        {/* AMRAP reps input — shown on weeks 1-3 when lift has not yet been marked */}
        {isAmrapWeek && !currentStatus && (
          <div className="flex items-center gap-3">
            <label htmlFor={amrapInputId} className="flex-1 text-sm text-gray-600">Reps on the AMRAP set</label>
            {inputOutcomeBadge && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inputOutcomeBadge.classes}`}>
                {inputOutcomeBadge.label}
              </span>
            )}
            <input
              id={amrapInputId}
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              value={inputReps}
              onChange={(e) => setAmrapRepsInput(prev => ({ ...prev, [exerciseId]: e.target.value }))}
              className="tabular h-11 w-20 px-2 text-center font-semibold"
              placeholder="12"
            />
          </div>
        )}

        {/* Show recorded AMRAP reps if already completed */}
        {isAmrapWeek && currentStatus && recordedAmrapReps != null && (
          <p className="text-sm text-gray-600">
            AMRAP: <span className="tabular font-semibold text-gray-900">{recordedAmrapReps} reps</span>
            {recordedOutcomeBadge && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${recordedOutcomeBadge.classes}`}>
                {recordedOutcomeBadge.label}
              </span>
            )}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSetStatus(exerciseId, 'completed', isAmrapWeek ? (parsedInputReps > 0 ? parsedInputReps : null) : null)}
            disabled={isUpdating || currentStatus === 'completed'}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
              currentStatus === 'completed'
                ? 'bg-success-600 text-white'
                : 'bg-success-50 text-success-700 hover:bg-success-100 disabled:opacity-50'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Completed
          </button>
          <button
            type="button"
            onClick={() => handleSetStatus(exerciseId, 'failed')}
            disabled={isUpdating || currentStatus === 'failed'}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
              currentStatus === 'failed'
                ? 'bg-danger-600 text-white'
                : 'bg-danger-50 text-danger-700 hover:bg-danger-100 disabled:opacity-50'
            }`}
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
            {currentStatus === 'failed' ? 'Failed' : 'Missed reps'}
          </button>
        </div>

        {currentStatus && (
          <Button variant="ghost" size="sm" fullWidth icon={RotateCcw} onClick={() => handleClearStatus(exerciseId)} disabled={isUpdating}>
            {isUpdating ? 'Updating…' : 'Clear result'}
          </Button>
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
        <div className="max-w-3xl mx-auto">
          <LoadingState label="Loading this week's workout..." />
        </div>
      </Layout>
    );
  }

  if (!workout) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <EmptyState
            icon="📅"
            title="No active program"
            description="This page shows the current week of your active training program. Create a program, or set one as active, to see this week's lifts."
            action={<Button to="/programs">Go to Programs</Button>}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          backTo="/programs"
          backLabel="Programs"
          title={workout.program_name}
          subtitle={(
            <span className="font-semibold">
              {workout.program_type === '531' ? `Week ${workout.week} · Cycle ${workout.cycle}` : ''}
              {workout.program_type === 'starting_strength' ? `Session ${workout.session_number} · ${workout.workout_type}` : ''}
            </span>
          )}
        />

        {/* Training Max Update Preview for Starting Strength */}
        {workout.lifts && workout.lifts.length > 0 && workout.program_type === 'starting_strength' && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-primary-50 border border-purple-200 rounded-lg p-3 sm:p-6">
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
                      <div key={idx} className="bg-surface/60 rounded-lg p-2.5 sm:p-3">
                        {/* Mobile: Stack layout */}
                        <div className="flex flex-col gap-2 sm:hidden">
                          <div className="flex items-start justify-between">
                            <span className="font-medium text-gray-900 text-sm flex-1 min-w-0">{lift.exercise_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isFailed ? 'bg-danger-100 text-danger-700' : 'bg-success-100 text-success-700'}`}>
                              {change > 0 ? '+' : ''}{change} lbs
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{currentMax} lbs</span>
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-4 h-4 ${isFailed ? 'text-danger-500' : 'text-success-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                {isFailed ? (
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                ) : (
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                )}
                              </svg>
                              <span className={`font-bold ${isFailed ? 'text-danger-600' : 'text-success-600'}`}>
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
                            <svg className={`w-4 h-4 ${isFailed ? 'text-danger-500' : 'text-success-500'}`} fill="currentColor" viewBox="0 0 20 20">
                              {isFailed ? (
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                              )}
                            </svg>
                            <span className={`font-bold text-sm ${isFailed ? 'text-danger-600' : 'text-success-600'}`}>
                              {newMax} lbs
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isFailed ? 'bg-danger-100 text-danger-700' : 'bg-success-100 text-success-700'}`}>
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
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-primary-50 border border-purple-200 rounded-lg p-3 sm:p-6">
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

                        const failedWeeks = getFailedWeeks(lift.exercise_id);
                        const week3Reps = getWeek3AmrapReps(lift.exercise_id);

                        // Suggested adjustment (from performance) vs. the effective
                        // one (the user's override, if they picked a different option)
                        const defaultAdjustment = getDefaultAdjustment(lift.exercise_id);
                        const adjustment = getEffectiveAdjustment(lift.exercise_id);
                        const isOverridden = adjustment !== defaultAdjustment;

                        const option = getAdjustmentOption(adjustment);
                        const change = option.delta(increment);
                        const newMax = Math.max(45, currentMax + change);

                        const handleChange = (e) => {
                          const value = e.target.value;
                          setAdjustmentOverrides(prev => ({ ...prev, [lift.exercise_id]: value }));
                        };

                        const resetToSuggested = () => {
                          setAdjustmentOverrides(prev => {
                            const next = { ...prev };
                            delete next[lift.exercise_id];
                            return next;
                          });
                        };

                        // Short explanation of where the suggestion comes from
                        let reasonText;
                        if (failedWeeks.length > 0) {
                          reasonText = `Failed in week${failedWeeks.length > 1 ? 's' : ''} ${failedWeeks.join(', ')}`;
                        } else if (week3Reps !== null) {
                          reasonText = `Week 3 AMRAP: ${week3Reps} rep${week3Reps === 1 ? '' : 's'}`;
                        } else {
                          reasonText = 'No week 3 AMRAP reps recorded';
                        }

                        return (
                          <div key={idx} className="bg-surface/60 rounded-lg p-2.5 sm:p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm">{lift.exercise_name}</div>
                                <div className={`text-xs mt-0.5 ${failedWeeks.length > 0 ? 'text-danger-600' : 'text-gray-500'}`}>
                                  {reasonText}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="flex items-center justify-end gap-1.5 text-sm">
                                  <span className="text-gray-600">{currentMax}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className={`font-bold ${option.text}`}>{newMax} lbs</span>
                                </div>
                                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${option.badge}`}>
                                  {change > 0 ? '+' : ''}{change} lbs
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                value={adjustment}
                                onChange={handleChange}
                                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-surface text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                              >
                                {ADJUSTMENT_OPTIONS.map(opt => {
                                  const d = opt.delta(increment);
                                  const deltaLabel = d === 0 ? '0' : `${d > 0 ? '+' : ''}${d}`;
                                  return (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label} ({deltaLabel} lbs){opt.value === defaultAdjustment ? ' — suggested' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                              {isOverridden && (
                                <button
                                  onClick={resetToSuggested}
                                  className="text-xs text-purple-700 underline"
                                >
                                  Reset to suggested
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation of how the suggested adjustments are derived */}
                    <div className="mt-3 flex items-start gap-2 text-xs text-purple-700 bg-purple-50 rounded-lg p-2.5">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="leading-relaxed">
                        Suggested changes are based on your <strong>week 3 (1-rep week) AMRAP reps</strong>:
                        {' '}<strong>11+</strong> → increase 2x, <strong>5-10</strong> → increase 1x,
                        {' '}<strong>1-4</strong> → keep the same, <strong>0 or a failed week</strong> → decrease.
                        {' '}Use the dropdown to choose a different adjustment for any lift.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Display */}
        {message.text && (
          <Alert
            tone={message.type === 'success' || message.type === 'error' ? message.type : 'info'}
            className="mb-4 sm:mb-6"
            onDismiss={() => setMessage({ type: '', text: '' })}
          >
            {message.text}
          </Alert>
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
          
          <Button
            size="lg"
            fullWidth
            icon={CalendarCheck}
            className="sm:w-auto"
            onClick={handleCompleteWeek}
            disabled={advancing}
          >
            {advancing ? 'Advancing…' : workout.program_type === '531' ? `Finish week ${workout.week}` : 'Finish session'}
          </Button>
        </div>

        {/* Starting Strength Auto-Progression Notice */}
        {workout.program_type === 'starting_strength' && (
          <div className="mb-4 sm:mb-6 bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-primary-700">
              Weights will automatically increase after you complete this session
            </p>
          </div>
        )}

        {/* Lifts */}
        <div className="space-y-3 sm:space-y-4">
          {workout.lifts && workout.lifts.map((lift, liftIndex) => {
            const collapsed = isLiftCollapsed(lift.exercise_id);
            const topSet = lift.main_sets?.[lift.main_sets.length - 1] ?? lift.sets?.[0];
            const statusRing = lift.status === 'completed'
              ? '!border-success-300'
              : lift.status === 'failed'
                ? '!border-danger-300'
                : '';
            return (
              <Card key={lift.exercise_id} padding="p-0" className={`overflow-hidden ${statusRing}`}>
                {/* Header: tap to expand / collapse */}
                <button
                  type="button"
                  onClick={() => toggleLiftCollapse(lift.exercise_id)}
                  aria-expanded={!collapsed}
                  className="flex w-full items-center gap-3 p-4 text-left sm:px-5"
                >
                  <span
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      lift.status === 'completed'
                        ? 'bg-success-600 text-white'
                        : lift.status === 'failed'
                          ? 'bg-danger-600 text-white'
                          : 'bg-primary-50 text-primary-700'
                    }`}
                  >
                    {lift.status === 'completed' ? <Check className="h-5 w-5" strokeWidth={3} />
                      : lift.status === 'failed' ? <X className="h-5 w-5" strokeWidth={3} />
                        : liftIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{lift.exercise_name}</span>
                    <span className="tabular block truncate text-xs text-gray-500">
                      {workout.program_type === '531' && `TM ${lift.training_max} lbs`}
                      {workout.program_type === 'starting_strength' && `Working weight ${lift.current_weight} lbs`}
                      {topSet && ` · Top set ${getAdjustedWeightInfo(topSet.weight).weight} × ${topSet.reps}${topSet.is_amrap ? '+' : ''}`}
                    </span>
                  </span>
                  {lift.status && <StatusIndicator status={lift.status} />}
                  <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                </button>

                {!collapsed && (
                  <div className="border-t border-gray-100 px-4 pb-4 sm:px-5">
                    {/* 5/3/1 */}
                    {workout.program_type === '531' && (
                      <>
                        {lift.warmup_sets?.length > 0 && (
                          <section className="pt-3">
                            <p className="eyebrow">Warm-up</p>
                            <ul className="divide-y divide-gray-100">
                              {lift.warmup_sets.map((set, i) => (
                                <ProgramSetRow
                                  key={`w${i}`}
                                  tone="warmup"
                                  label={`W${i + 1}`}
                                  weight={<WeightDisplay programmedWeight={set.weight} />}
                                  reps={set.reps}
                                  plateWeight={getAdjustedWeightInfo(set.weight).weight}
                                />
                              ))}
                            </ul>
                          </section>
                        )}

                        <section className="pt-3">
                          <p className="eyebrow">Main sets</p>
                          <ul className="divide-y divide-gray-100">
                            {lift.main_sets?.map((set, i) => (
                              <ProgramSetRow
                                key={`m${i}`}
                                label={set.set_number}
                                weight={<WeightDisplay programmedWeight={set.weight} />}
                                reps={`${set.reps}${set.is_amrap ? '+' : ''}`}
                                caption={`${set.percentage}% of training max`}
                                badge={set.is_amrap ? <Badge tone="warning">AMRAP</Badge> : null}
                                plateWeight={getAdjustedWeightInfo(set.weight).weight}
                              />
                            ))}
                          </ul>
                        </section>

                        {lift.accessory_sets?.length > 0 && (
                          <section className="pt-3">
                            <p className="eyebrow">Boring But Big</p>
                            <ul>
                              <ProgramSetRow
                                tone="accessory"
                                label={`${lift.accessory_sets.length}×`}
                                weight={<WeightDisplay programmedWeight={lift.accessory_sets[0].weight} />}
                                reps={lift.accessory_sets[0].reps}
                                caption={`${lift.accessory_sets[0].percentage}% TM · same weight every set · rest 1–2 min`}
                                plateWeight={getAdjustedWeightInfo(lift.accessory_sets[0].weight).weight}
                              />
                            </ul>
                          </section>
                        )}
                      </>
                    )}

                    {/* Starting Strength */}
                    {workout.program_type === 'starting_strength' && lift.sets && (
                      <>
                        {lift.warmup_sets?.length > 0 && (
                          <section className="pt-3">
                            <p className="eyebrow">Warm-up</p>
                            <ul className="divide-y divide-gray-100">
                              {lift.warmup_sets.map((set, i) => (
                                <ProgramSetRow
                                  key={`w${i}`}
                                  tone="warmup"
                                  label={`W${i + 1}`}
                                  weight={<WeightDisplay programmedWeight={set.weight} />}
                                  reps={set.reps}
                                  plateWeight={getAdjustedWeightInfo(set.weight).weight}
                                />
                              ))}
                            </ul>
                          </section>
                        )}
                        <section className="pt-3">
                          <p className="eyebrow">Working sets</p>
                          <ul>
                            <ProgramSetRow
                              label={`${lift.sets.length}×`}
                              weight={<WeightDisplay programmedWeight={lift.sets[0].weight} />}
                              reps={lift.sets[0].reps}
                              caption={`Next session: ${lift.sets[0].weight + (lift.exercise_name === 'Barbell Squat' || lift.exercise_name === 'Barbell Deadlift' ? 10 : 5)} lbs · rest 3–5 min`}
                              plateWeight={getAdjustedWeightInfo(lift.sets[0].weight).weight}
                            />
                          </ul>
                        </section>
                      </>
                    )}

                    <div className="mt-3 space-y-3 border-t border-gray-100 pt-4">
                      <Button fullWidth icon={Play} onClick={() => handleStartWorkout(lift)}>
                        Start workout
                      </Button>
                      {renderStatusControls({
                        exerciseId: lift.exercise_id,
                        currentStatus: lift.status,
                        recordedAmrapReps: lift.amrap_reps,
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Training Notes */}
        <div className="mt-6 sm:mt-8 bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4 md:p-6">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-primary-900 mb-2 sm:mb-3">💡 Training Notes</h3>
          
          {/* 5/3/1 Notes */}
          {workout.program_type === '531' && (
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-primary-800">
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
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-primary-800">
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