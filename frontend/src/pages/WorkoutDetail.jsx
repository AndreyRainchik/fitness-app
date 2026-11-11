import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  StatTile,
  useConfirm,
  useToast
} from '../components/ui';
import { groupSetsByExercise } from '../utils/workoutPayload';

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
      message: `“${workout.name || 'Untitled workout'}” and all its sets will be permanently deleted.`,
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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
        <div className="max-w-4xl mx-auto">
          <LoadingState label="Loading workout..." />
        </div>
      </Layout>
    );
  }

  if (error || !workout) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
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

  const exerciseGroups = groupSetsByExercise(workout.sets || []);
  const totalVolume = workout.sets?.reduce((sum, set) => sum + (set.weight * set.reps), 0) || 0;
  const totalPRs = getTotalPRCount();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          backTo="/workouts"
          backLabel="Back to Workouts"
          title={workout.name || 'Untitled workout'}
          subtitle={(
            <>
              {formatDate(workout.date)}
              {workout.duration_minutes > 0 && ` • ${workout.duration_minutes} minutes`}
            </>
          )}
          actions={(
            <>
              <Button to={`/workouts/${id}/edit`}>Edit Workout</Button>
              <Button variant="secondary" onClick={() => setShowTemplateModal(true)}>Save as Template</Button>
              <Button variant="danger-subtle" onClick={handleDelete}>Delete</Button>
            </>
          )}
        />

        {/* PR Celebration Banner */}
        {prSummary.length > 0 && totalPRs > 0 && (
          <div className="bg-gradient-to-r from-pink-500 via-orange-400 to-purple-400 rounded-lg shadow-lg p-4 md:p-6 mb-8 text-white">
            <div className="flex items-start md:items-center gap-3 mb-4">
              <span className="text-4xl md:text-5xl">🏆</span>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  Congratulations! You hit {totalPRs} PR{totalPRs !== 1 ? 's' : ''} in this workout!
                </h2>
                <p className="text-sm md:text-base text-white text-opacity-90">Personal Records achieved:</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {prSummary.map((exercise, idx) => (
                <div key={idx} className="bg-white bg-opacity-20 rounded-lg p-3 md:p-4">
                  <h3 className="font-bold text-base md:text-lg mb-2">{exercise.exerciseName}</h3>
                  <div className="space-y-1 text-xs md:text-sm">
                    {exercise.volumePRs.map((pr, prIdx) => (
                      <div key={`vol-${prIdx}`} className="flex items-start md:items-center gap-2">
                        <span className="text-lg md:text-xl flex-shrink-0">🏆</span>
                        <span className="break-words">
                          Set {pr.setNumber}: {pr.weight} {units} × {pr.reps} reps
                          <span className="font-bold ml-2">Volume PR!</span>
                          <span className="ml-1 text-white text-opacity-80">
                            ({pr.volume.toLocaleString()} {units} total)
                          </span>
                        </span>
                      </div>
                    ))}
                    {exercise.oneRMPRs.map((pr, prIdx) => (
                      <div key={`1rm-${prIdx}`} className="flex items-start md:items-center gap-2">
                        <span className="text-lg md:text-xl flex-shrink-0">🏆</span>
                        <span className="break-words">
                          Set {pr.setNumber}: {pr.weight} {units} × {pr.reps} reps
                          <span className="font-bold ml-2">1RM PR!</span>
                          <span className="ml-1 text-white text-opacity-80">
                            (Est. {pr.estimated1RM} {units})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatTile label="Total Volume" value={totalVolume.toLocaleString()} unit={units} tone="primary" />
          <StatTile label="Exercises" value={exerciseGroups.length} tone="success" />
          <StatTile label="Total Sets" value={workout.sets?.length || 0} tone="warning" />
        </div>

        {/* Exercises */}
        <div className="space-y-6">
          {exerciseGroups.map((group, index) => (
            <Card key={index}>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
                {group.exercise_name}
              </h2>

              {/* Sets Table - Mobile Optimized */}
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700">Set</th>
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700">
                          Weight<span className="hidden sm:inline"> ({units})</span>
                        </th>
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700">Reps</th>
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700">RPE</th>
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700">
                          <span className="hidden sm:inline">Volume</span>
                          <span className="sm:hidden">Vol</span>
                        </th>
                        <th className="text-left py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sets.map((set) => {
                        const hasPR = set.isVolumePR || set.is1RMPR;
                        const rowClass = hasPR 
                          ? "border-b last:border-0 bg-success-50 hover:bg-success-100" 
                          : "border-b last:border-0 hover:bg-gray-50";
                        
                        return (
                          <tr key={set.id} className={rowClass}>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-900">{set.set_number}</td>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-900 font-medium">{set.weight}</td>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-900 font-medium">{set.reps}</td>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-900">
                              {set.is_warmup === 1 ? (
                                <span className="text-success-600 font-bold text-base md:text-lg">W</span>
                              ) : (
                                set.rpe || '-'
                              )}
                            </td>
                            <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-600">{set.weight * set.reps}</td>
                            <td className="py-2 md:py-3 px-2 md:px-3">
                              {hasPR && (
                                <div className="flex flex-col gap-1 text-xs">
                                  {set.isVolumePR && (
                                    <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 md:py-1 bg-yellow-100 text-yellow-800 rounded font-semibold whitespace-nowrap">
                                      🏆 <span className="hidden sm:inline ml-1">Volume PR</span>
                                    </span>
                                  )}
                                  {set.is1RMPR && (
                                    <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 md:py-1 bg-orange-100 text-orange-800 rounded font-semibold whitespace-nowrap">
                                      🏆 <span className="hidden sm:inline ml-1">1RM PR</span>
                                      <span className="ml-1 text-gray-600 hidden md:inline">
                                        ({set.estimated1RM} {units})
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="py-2 md:py-3 px-2 md:px-3 text-xs md:text-base text-gray-700" colSpan="4">
                          <span className="hidden sm:inline">Subtotal</span>
                          <span className="sm:hidden">Total</span>
                        </td>
                        <td className="py-2 md:py-3 px-2 md:px-3 text-sm md:text-base text-gray-900">
                          {group.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Workout Notes */}
        {workout.notes && (
          <Card className="mt-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">Workout Notes</h2>
            <p className="text-sm md:text-base text-gray-700 whitespace-pre-wrap">{workout.notes}</p>
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

export default WorkoutDetail;