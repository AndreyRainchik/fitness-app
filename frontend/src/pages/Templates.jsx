import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Play, Trash2 } from 'lucide-react';
import { templatesAPI } from '../services/api';
import { plural } from '../utils/format';
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
      <div>
        <PageHeader
          title="Templates"
          subtitle="Save and reuse your favorite workout routines"
        />

        {error && <Alert className="mb-6">{error}</Alert>}

        {loading ? (
          <LoadingState label="Loading templates..." />
        ) : templates.length === 0 ? (
          !error && (
            <EmptyState
              icon={ClipboardList}
              title="No templates yet"
              description="Open any saved workout and choose “Save as Template” to reuse it later."
              action={<Button to="/workouts">View Your Workouts</Button>}
            />
          )
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} padding="p-4 sm:p-5" className="flex flex-col">
                <Link to={`/templates/${template.id}`} className="group -m-1 mb-3 flex items-start gap-3 rounded-xl p-1">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900 group-hover:text-primary-700">{template.name}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {template.description || `Created ${formatDate(template.created_at)}`}
                    </span>
                  </span>
                  <ChevronRight className="mt-2.5 h-4 w-4 flex-shrink-0 text-gray-300" />
                </Link>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  <span className="chip">{plural(template.exercise_count, 'exercise')}</span>
                  <span className="chip">{plural(template.total_sets, 'set')}</span>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button
                    className="flex-1"
                    icon={Play}
                    onClick={() => handleStartWorkout(template.id)}
                    loading={startingId === template.id}
                    loadingText="Starting..."
                  >
                    Start workout
                  </Button>
                  <Button
                    variant="danger-subtle"
                    iconOnly
                    icon={Trash2}
                    onClick={() => handleDelete(template)}
                    aria-label={`Delete ${template.name}`}
                    title="Delete template"
                  />
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
