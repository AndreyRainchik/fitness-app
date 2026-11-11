import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { workoutsAPI, templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { getLocalDateString } from '../utils/dateUtils';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

const blankWorkout = () => ({ name: '', date: getLocalDateString(), notes: '', exercises: [] });

function NewWorkout() {
  const navigate = useNavigate();

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
      alert('Failed to load templates: ' + err.message);
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
      alert('Failed to load template: ' + err.message);
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
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-0">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Workout</h1>
              <p className="text-sm text-gray-600">Log your session</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link
                to="/templates"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200 text-center text-sm sm:text-base"
              >
                View Templates
              </Link>
              <button
                onClick={loadTemplates}
                disabled={loadingTemplates}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-sm sm:text-base"
              >
                {loadingTemplates ? 'Loading...' : 'Start from Template'}
              </button>
            </div>
          </div>
        </header>

        <WorkoutEditor
          key={editorKey}
          initialValues={initialValues}
          onSubmit={handleSave}
          onCancel={() => navigate('/dashboard')}
          submitLabel="Save Workout"
        />

        {/* Template Selector Modal */}
        {showTemplateSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Choose a Template</h2>
                <button
                  onClick={() => setShowTemplateSelector(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No templates saved yet</p>
                  <Link
                    to="/workouts"
                    onClick={() => setShowTemplateSelector(false)}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Save a workout as a template first
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition"
                      onClick={() => loadFromTemplate(template.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>{template.exercise_count} exercises</span>
                            <span>{template.total_sets} sets</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadFromTemplate(template.id);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default NewWorkout;
