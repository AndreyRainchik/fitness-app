import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClipboardList, Pencil, Trash2, Trophy } from 'lucide-react';
import { workoutsAPI, templatesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Modal,
  PageHeader,
  useConfirm,
  useToast
} from '../components/ui';
import { groupSetsByExercise } from '../utils/workoutPayload';
import { formatNumber } from '../utils/format';
import { ExerciseSetsCard, WorkoutStats } from '../components/Workout/ExerciseSetsCard';
import CardioSessionView from '../components/Cardio/CardioSessionView';
import { distanceUnit, sessionTitle, sportInfo } from '../utils/cardio';

function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const confirm = useConfirm();
  const toast = useToast();
  const [workout, setWorkout] = useState(null);
  const [prSummary, setPRSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        // Includes PR detection for each set
        const data = await workoutsAPI.getByIdWithPRs(id);
        if (cancelled) return;
        setWorkout(data.workout);
        setPRSummary(data.prSummary || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete workout?',
      message: workout.kind === 'cardio'
        ? `“${workout.name || sessionTitle(workout.cardio?.sport, workout.cardio?.environment)}” will be permanently deleted.`
        : `“${workout.name || 'Untitled workout'}” and all its sets will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await workoutsAPI.delete(id);
      toast({ tone: 'success', message: 'Workout deleted' });
      navigate('/workouts');
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete workout: ${err.message}` });
    }
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateName('');
    setTemplateDescription('');
  };

  const handleSaveAsTemplate = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) return; // the input is `required`

    setSavingTemplate(true);
    try {
      await templatesAPI.createFromWorkout(id, {
        name: templateName.trim(),
        description: templateDescription.trim()
      });
      closeTemplateModal();
      toast({
        tone: 'success',
        message: `Saved “${templateName.trim()}” as a template`,
        action: { label: 'View templates', to: '/templates' }
      });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't save template: ${err.message}` });
    } finally {
      setSavingTemplate(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const getTotalPRCount = () => {
    let count = 0;
    prSummary.forEach(exercise => {
      count += exercise.volumePRs.length + exercise.oneRMPRs.length;
    });
    return count;
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <LoadingState label="Loading workout..." />
        </div>
      </Layout>
    );
  }

  if (error || !workout) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <EmptyState
            tone="error"
            title="Couldn't load this workout"
            description={error}
            action={<Button variant="secondary" to="/workouts">← Back to Workouts</Button>}
          />
        </div>
      </Layout>
    );
  }

  if (workout.kind === 'cardio') {
    const SportIcon = sportInfo(workout.cardio?.sport).icon;
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <PageHeader
            backTo="/workouts"
            backLabel="History"
            eyebrow={(
              <span className="inline-flex items-center gap-1.5">
                <SportIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {sessionTitle(workout.cardio?.sport, workout.cardio?.environment)}
              </span>
            )}
            title={workout.name || sessionTitle(workout.cardio?.sport, workout.cardio?.environment)}
            subtitle={(
              <>
                {formatDate(workout.date)}
                {workout.start_time && ` · ${new Date(workout.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              </>
            )}
            actions={(
              <>
                <Button variant="secondary" icon={Pencil} to={`/cardio/${id}/edit`}>Edit</Button>
                <Button variant="danger-subtle" iconOnly icon={Trash2} onClick={handleDelete} aria-label="Delete session" title="Delete session" />
              </>
            )}
          />
          <CardioSessionView workout={workout} unit={distanceUnit(units)} />
        </div>
      </Layout>
    );
  }

  const exerciseGroups = groupSetsByExercise(workout.sets || []);
  const totalVolume = workout.sets?.reduce((sum, set) => sum + (set.weight * set.reps), 0) || 0;
  const totalPRs = getTotalPRCount();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          backTo="/workouts"
          backLabel="History"
          title={workout.name || 'Untitled workout'}
          subtitle={(
            <>
              {formatDate(workout.date)}
              {workout.duration_minutes > 0 && ` · ${workout.duration_minutes} min`}
              {workout.hevy_workout_id && ' · Imported from Hevy'}
            </>
          )}
          actions={(
            <>
              <Button variant="secondary" icon={Pencil} to={`/workouts/${id}/edit`}>Edit</Button>
              <Button variant="secondary" icon={ClipboardList} onClick={() => setShowTemplateModal(true)}>Save as template</Button>
              <Button variant="danger-subtle" iconOnly icon={Trash2} onClick={handleDelete} aria-label="Delete workout" title="Delete workout" />
            </>
          )}
        />

        {/* PR summary */}
        {prSummary.length > 0 && totalPRs > 0 && (
          <Card padding="p-4 sm:p-5" className="mb-6 !border-warning-200 !bg-warning-50">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-500 text-white shadow-sm">
                <Trophy className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-warning-900">
                  {totalPRs} personal record{totalPRs === 1 ? '' : 's'}
                </h2>
                <p className="text-xs text-warning-800">Best sets ever for these lifts</p>
              </div>
            </div>
            <ul className="space-y-2">
              {prSummary.map((exercise) => {
                const best1RM = Math.max(0, ...exercise.oneRMPRs.map((p) => p.estimated1RM));
                const bestVolume = Math.max(0, ...exercise.volumePRs.map((p) => p.volume));
                return (
                  <li key={exercise.exerciseName} className="rounded-xl bg-surface/70 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-gray-900">{exercise.exerciseName}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                      {best1RM > 0 && <span>Est. 1RM <b className="tabular font-semibold text-gray-900">{formatNumber(best1RM, 1)}</b> {units}</span>}
                      {bestVolume > 0 && <span>Set volume <b className="tabular font-semibold text-gray-900">{formatNumber(bestVolume)}</b> {units}</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <WorkoutStats volume={totalVolume} exercises={exerciseGroups.length} sets={workout.sets?.length || 0} units={units} />

        <div className="space-y-4">
          {exerciseGroups.map((group, index) => <ExerciseSetsCard key={index} group={group} units={units} />)}
        </div>

        {/* Workout Notes */}
        {workout.notes && (
          <Card className="mt-4">
            <p className="eyebrow mb-1.5">Notes</p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{workout.notes}</p>
          </Card>
        )}

        {/* No Sets Message */}
        {workout.sets?.length === 0 && (
          <EmptyState title="No sets logged for this workout" />
        )}

        <Modal
          open={showTemplateModal}
          onClose={closeTemplateModal}
          title="Save as Template"
          dismissible={!savingTemplate}
          footer={(
            <>
              <Button variant="secondary" onClick={closeTemplateModal} disabled={savingTemplate}>
                Cancel
              </Button>
              <Button type="submit" form="save-template-form" loading={savingTemplate} loadingText="Saving...">
                Save Template
              </Button>
            </>
          )}
        >
          <form id="save-template-form" onSubmit={handleSaveAsTemplate} className="space-y-4">
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
                Template name
              </label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Upper Body A"
                className="h-11 w-full px-3.5"
                required
              />
            </div>
            <div>
              <label htmlFor="template-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="e.g., Chest and back focus"
                rows={3}
                className="w-full px-3.5 py-2.5"
              />
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

export default WorkoutDetail;