import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { Button, EmptyState, LoadingState, PageHeader, useToast } from '../components/ui';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

function EditTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [initialValues, setInitialValues] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setInitialValues(null);
      setLoadError('');
      try {
        const { template } = await templatesAPI.getById(id);
        if (cancelled) return;
        setInitialValues({
          name: template.name || '',
          // The editor's notes field holds the template description
          notes: template.description || '',
          // The template's sets are replaced on save, so no ids are kept
          exercises: setsToExerciseBlocks(template.sets)
        });
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load template');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async ({ name, notes, sets }) => {
    // Updates the template and replaces its set list in one request
    await templatesAPI.update(id, { name, description: notes || null, sets });
    toast({ tone: 'success', message: 'Template saved' });
    navigate(`/templates/${id}`);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Edit Template"
          subtitle="Change the exercises, sets and targets this template starts with"
          backTo={`/templates/${id}`}
          backLabel="Back to Template"
        />

        {loadError ? (
          <EmptyState
            tone="error"
            title="Couldn't load this template"
            description={loadError}
            action={<Button variant="secondary" to="/templates">Back to Templates</Button>}
          />
        ) : !initialValues ? (
          <LoadingState label="Loading template..." />
        ) : (
          <WorkoutEditor
            key={id}
            initialValues={initialValues}
            onSubmit={handleSave}
            onCancel={() => navigate(`/templates/${id}`)}
            submitLabel="Save template"
            showDate={false}
            nameLabel="Template name"
            namePlaceholder="e.g., Push Day"
            notesLabel="Description"
            notesPlaceholder="What is this template for?"
            addNotesLabel="Add description"
          />
        )}
      </div>
    </Layout>
  );
}

export default EditTemplate;
