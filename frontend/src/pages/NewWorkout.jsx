import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutsAPI, templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { Button, Modal, PageHeader, useToast } from '../components/ui';
import { getLocalDateString } from '../utils/dateUtils';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

const blankWorkout = () => ({ name: '', date: getLocalDateString(), notes: '', exercises: [] });

function NewWorkout() {
  const navigate = useNavigate();
  const toast = useToast();

  // Changing editorKey remounts the editor with new initial values (template load)
  const [initialValues, setInitialValues] = useState(blankWorkout);
  const [editorKey, setEditorKey] = useState(0);

  // Template selection
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await templatesAPI.getAll();
      setTemplates(data.templates);
      setShowTemplateSelector(true);
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't load templates: ${err.message}` });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadFromTemplate = async (templateId) => {
    try {
      const data = await templatesAPI.getById(templateId);
      const template = data.template;
      setInitialValues({
        ...blankWorkout(),
        name: template.name,
        exercises: setsToExerciseBlocks(template.sets)
      });
      setEditorKey((k) => k + 1);
      setShowTemplateSelector(false);
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't load template: ${err.message}` });
    }
  };

  const handleSave = async ({ name, date, notes, sets }) => {
    const workout = await workoutsAPI.create({
      name,
      date,
      ...(notes ? { notes } : {}),
      sets
    });
    navigate(`/workout/${workout.workout.id}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="New Workout"
          subtitle="Log your session"
          actions={(
            <>
              <Button variant="secondary" to="/templates">View Templates</Button>
              <Button variant="secondary" onClick={loadTemplates} loading={loadingTemplates} loadingText="Loading...">
                Start from Template
              </Button>
            </>
          )}
        />

        <WorkoutEditor
          key={editorKey}
          initialValues={initialValues}
          onSubmit={handleSave}
          onCancel={() => navigate('/dashboard')}
          submitLabel="Save Workout"
        />

        <Modal
          open={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          title="Choose a Template"
          size="lg"
        >
          {templates.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">
                No templates yet. Open any saved workout and choose “Save as Template”.
              </p>
              <Button variant="secondary" to="/workouts">Go to Workout History</Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => loadFromTemplate(template.id)}
                    className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition"
                  >
                    <span className="block font-bold text-gray-900">{template.name}</span>
                    {template.description && (
                      <span className="block text-sm text-gray-600 mt-1">{template.description}</span>
                    )}
                    <span className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>{template.exercise_count} exercises</span>
                      <span>{template.total_sets} sets</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      </div>
    </Layout>
  );
}

export default NewWorkout;
