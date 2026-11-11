import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  useConfirm,
  useToast
} from '../components/ui';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function Templates() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await templatesAPI.getAll();
        setTemplates(data.templates);
      } catch (err) {
        setError(err.message || 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (template) => {
    const confirmed = await confirm({
      title: 'Delete template?',
      message: `“${template.name}” will be permanently deleted. Workouts you logged from it are not affected.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await templatesAPI.delete(template.id);
      setTemplates((list) => list.filter((t) => t.id !== template.id));
      toast({ tone: 'success', message: 'Template deleted' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete template: ${err.message}` });
    }
  };

  const handleStartWorkout = async (templateId) => {
    setStartingId(templateId);
    try {
      const data = await templatesAPI.getById(templateId);
      navigate('/workout/active', {
        state: { template: data.template, fromTemplate: true }
      });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't load template: ${err.message}` });
      setStartingId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Workout Templates"
          subtitle="Save and reuse your favorite workout routines"
        />

        {error && <Alert className="mb-6">{error}</Alert>}

        {loading ? (
          <LoadingState label="Loading templates..." />
        ) : templates.length === 0 ? (
          !error && (
            <EmptyState
              icon="📋"
              title="No templates yet"
              description="Open any saved workout and choose “Save as Template” to reuse it later."
              action={<Button to="/workouts">View Your Workouts</Button>}
            />
          )
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="flex flex-col hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    <Link to={`/templates/${template.id}`} className="hover:text-primary-700">
                      {template.name}
                    </Link>
                  </h2>
                  {template.description && (
                    <p className="text-sm text-gray-600">{template.description}</p>
                  )}
                </div>

                <div className="flex gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600">Exercises: </span>
                    <span className="font-semibold text-gray-900">{template.exercise_count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Sets: </span>
                    <span className="font-semibold text-gray-900">{template.total_sets}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4">Created {formatDate(template.created_at)}</p>

                <div className="mt-auto flex flex-col gap-2">
                  <Button
                    fullWidth
                    onClick={() => handleStartWorkout(template.id)}
                    loading={startingId === template.id}
                    loadingText="Starting..."
                  >
                    Start Workout
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" to={`/templates/${template.id}`} className="flex-1">
                      View
                    </Button>
                    <Button
                      variant="danger-subtle"
                      onClick={() => handleDelete(template)}
                      className="flex-1"
                      aria-label={`Delete ${template.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Templates;
