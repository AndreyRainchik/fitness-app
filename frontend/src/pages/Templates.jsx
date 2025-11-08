import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import Layout from '../components/Layout/Layout';

function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await templatesAPI.getAll();
      setTemplates(data.templates);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await templatesAPI.delete(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  const handleStartWorkout = async (templateId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await templatesAPI.startWorkout(templateId, today);
      navigate(`/workout/${result.workoutId}`);
    } catch (err) {
      alert('Failed to start workout: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Workout Templates</h1>
            <p className="text-gray-600 mt-2">
              Save and reuse your favorite workout routines
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-xl font-semibold text-gray-900">No templates yet</h3>
            <p className="mt-1 text-gray-500 mb-6">
              Save your workouts as templates for quick reuse
            </p>
            <Link
              to="/workouts"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              View Your Workouts
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200"
              >
                <div className="p-6">
                  {/* Template Name */}
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {template.name}
                    </h2>
                    {template.description && (
                      <p className="text-sm text-gray-600">{template.description}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-600">Exercises: </span>
                      <span className="font-semibold text-gray-900">
                        {template.exercise_count}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sets: </span>
                      <span className="font-semibold text-gray-900">
                        {template.total_sets}
                      </span>
                    </div>
                  </div>

                  {/* Created Date */}
                  <p className="text-xs text-gray-500 mb-4">
                    Created {formatDate(template.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleStartWorkout(template.id)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                    >
                      Start Workout
                    </button>
                    <div className="flex gap-2">
                      <Link
                        to={`/templates/${template.id}`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 text-center"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Templates;