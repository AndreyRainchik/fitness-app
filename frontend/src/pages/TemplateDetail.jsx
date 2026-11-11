import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  StatTile,
  useConfirm,
  useToast
} from '../components/ui';
import { groupSetsByExercise } from '../utils/workoutPayload';

function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const confirm = useConfirm();
  const toast = useToast();

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await templatesAPI.getById(id);
        if (!cancelled) setTemplate(data.template);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load template');
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
      title: 'Delete template?',
      message: `“${template.name}” will be permanently deleted. Workouts you logged from it are not affected.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await templatesAPI.delete(id);
      toast({ tone: 'success', message: 'Template deleted' });
      navigate('/templates');
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete template: ${err.message}` });
    }
  };

  const handleStartWorkout = () => {
    navigate('/workout/active', {
      state: { template, fromTemplate: true }
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <LoadingState label="Loading template..." />
        </div>
      </Layout>
    );
  }

  if (error || !template) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <EmptyState
            tone="error"
            title="Couldn't load this template"
            description={error}
            action={<Button variant="secondary" to="/templates">← Back to Templates</Button>}
          />
        </div>
      </Layout>
    );
  }

  const exerciseGroups = groupSetsByExercise(template.sets || []);
  const totalVolume = template.sets?.reduce((sum, set) => sum + (set.weight * set.reps), 0) || 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          backTo="/templates"
          backLabel="Back to Templates"
          title={template.name}
          subtitle={(
            <>
              {template.description && <p className="mb-1">{template.description}</p>}
              <p className="text-sm text-gray-500">
                Template • {exerciseGroups.length} exercises • {template.sets?.length || 0} sets
              </p>
            </>
          )}
          actions={(
            <>
              <Button onClick={handleStartWorkout}>Start Workout</Button>
              <Button variant="danger-subtle" onClick={handleDelete}>Delete</Button>
            </>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatTile label="Total Volume" value={totalVolume.toLocaleString()} unit={units} tone="primary" />
          <StatTile label="Exercises" value={exerciseGroups.length} tone="success" />
          <StatTile label="Total Sets" value={template.sets?.length || 0} tone="warning" />
        </div>

        <div className="space-y-6">
          {exerciseGroups.map((group, index) => (
            <Card key={index}>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{group.exercise_name}</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Set</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Weight ({units})</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Reps</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">RPE</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sets.map((set) => (
                      <tr key={set.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-900">{set.set_number}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.weight}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.reps}</td>
                        <td className="py-3 px-3 text-gray-900">
                          {set.is_warmup === 1 ? (
                            <span className="text-success-600 font-bold text-lg" title="Warm-up">W</span>
                          ) : (
                            set.rpe || '-'
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-600">{set.weight * set.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-3 px-3 text-gray-700" colSpan="4">Subtotal</td>
                      <td className="py-3 px-3 text-gray-900">
                        {group.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}
        </div>

        {template.sets?.length === 0 && <EmptyState title="No sets in this template" />}
      </div>
    </Layout>
  );
}

export default TemplateDetail;
