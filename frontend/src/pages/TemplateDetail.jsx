import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { templatesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';

function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const data = await templatesAPI.getById(id);
      setTemplate(data.template);
    } catch (err) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await templatesAPI.delete(id);
      navigate('/templates');
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  const handleStartWorkout = () => {
    // Navigate to ActiveWorkout with template data
    navigate('/workout/active', {
      state: { 
        template: template,
        fromTemplate: true
      }
    });
  };

  const groupSetsByExercise = (sets) => {
    // Sort sets by ID to maintain insertion order
    const sortedSets = [...sets].sort((a, b) => a.id - b.id);
    
    // Group consecutive sets of the same exercise together
    // BUT start a new group if set_number resets (indicates new instance)
    const grouped = [];
    let currentGroup = null;
    let lastSetNumber = 0;
    
    sortedSets.forEach(set => {
      // Start a new group if:
      // 1. Exercise changes, OR
      // 2. Set number decreases/resets (indicates new block of same exercise)
      const setNumberReset = currentGroup && 
                            currentGroup.exercise_id === set.exercise_id && 
                            set.set_number <= lastSetNumber;
      
      if (!currentGroup || 
          currentGroup.exercise_id !== set.exercise_id || 
          setNumberReset) {
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          exercise_id: set.exercise_id,
          exercise_name: set.exercise_name,
          sets: []
        };
        lastSetNumber = 0;
      }
      
      currentGroup.sets.push(set);
      lastSetNumber = set.set_number;
    });
    
    // Push the last group
    if (currentGroup) {
      grouped.push(currentGroup);
    }
    
    return grouped;
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading template...</p>
        </div>
      </Layout>
    );
  }

  if (error || !template) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-xl text-red-600 mb-4">Failed to load template</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/templates"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← Back to Templates
          </Link>
        </div>
      </Layout>
    );
  }

  const exerciseGroups = groupSetsByExercise(template.sets || []);
  const totalVolume = template.sets?.reduce((sum, set) => sum + (set.weight * set.reps), 0) || 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/templates"
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Templates
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {template.name}
              </h1>
              {template.description && (
                <p className="text-gray-600 mb-2">{template.description}</p>
              )}
              <p className="text-sm text-gray-500">
                Template • {exerciseGroups.length} exercises • {template.sets?.length || 0} sets
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStartWorkout}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                Start Workout
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Volume</p>
            <p className="text-3xl font-bold text-blue-600">
              {totalVolume.toLocaleString()} <span className="text-lg">{user?.units || 'lbs'}</span>
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Exercises</p>
            <p className="text-3xl font-bold text-green-600">
              {exerciseGroups.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Sets</p>
            <p className="text-3xl font-bold text-orange-600">
              {template.sets?.length || 0}
            </p>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-6">
          {exerciseGroups.map((group, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {group.exercise_name}
              </h2>

              {/* Sets Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Set</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Weight ({user?.units || 'lbs'})</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Reps</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">RPE</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                      <tr key={set.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-900">{set.set_number}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.weight}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.reps}</td>
                        <td className="py-3 px-3 text-gray-900">
                          {set.is_warmup === 1 ? (
                            <span className="text-green-600 font-bold text-lg">W</span>
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
            </div>
          ))}
        </div>

        {/* No Sets Message */}
        {template.sets?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-xl text-gray-600">No sets in this template</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default TemplateDetail;