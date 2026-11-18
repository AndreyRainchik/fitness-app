import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  useConfirm,
  useToast
} from '../components/ui';
import { Play, Trash2 } from 'lucide-react';
import { groupSetsByExercise } from '../utils/workoutPayload';
import { plural } from '../utils/format';
import { ExerciseSetsCard, WorkoutStats } from '../components/Workout/ExerciseSetsCard';

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
        <div className="max-w-3xl mx-auto">
          <LoadingState label="Loading template..." />
        </div>
      </Layout>
    );
  }

  if (error || !template) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
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
      <div className="max-w-3xl mx-auto">
        <PageHeader
          backTo="/templates"
          backLabel="Templates"
          title={template.name}
          subtitle={(
            <>
              {template.description && <p className="mb-1">{template.description}</p>}
              <p className="text-sm text-gray-500">
                {plural(exerciseGroups.length, 'exercise')} · {plural(template.sets?.length || 0, 'set')}
              </p>
            </>
          )}
          actions={(
            <>
              <Button icon={Play} onClick={handleStartWorkout} className="flex-1 sm:flex-none">Start workout</Button>
              <Button variant="danger-subtle" iconOnly icon={Trash2} onClick={handleDelete} aria-label="Delete template" title="Delete template" />
            </>
          )}
        />

        <WorkoutStats volume={totalVolume} exercises={exerciseGroups.length} sets={template.sets?.length || 0} units={units} />

        <div className="space-y-4">
          {exerciseGroups.map((group, index) => <ExerciseSetsCard key={index} group={group} units={units} />)}
        </div>

        {template.sets?.length === 0 && <EmptyState title="No sets in this template" />}
      </div>
    </Layout>
  );
}

export default TemplateDetail;
