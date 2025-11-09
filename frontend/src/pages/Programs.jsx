import { useState, useEffect } from 'react';
import { programsAPI, exercisesAPI } from '../services/api';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const Programs = () => {
  const [programs, setPrograms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form state
  const [programName, setProgramName] = useState('');
  const [selectedLifts, setSelectedLifts] = useState([
    { exercise_id: '', training_max: '' },
    { exercise_id: '', training_max: '' },
    { exercise_id: '', training_max: '' },
    { exercise_id: '', training_max: '' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [programsData, exercisesData] = await Promise.all([
        programsAPI.getAll(),
        exercisesAPI.getAll()
      ]);
      // Programs API returns array directly
      setPrograms(Array.isArray(programsData) ? programsData : []);
      // Exercises API returns { exercises: [], count: n }
      setExercises(exercisesData.exercises || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load programs' });
      setExercises([]); // Ensure exercises is always an array
      setPrograms([]); // Ensure programs is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    
    // Validate
    if (!programName.trim()) {
      setMessage({ type: 'error', text: 'Program name is required' });
      return;
    }

    // Filter out empty lifts and validate
    const validLifts = selectedLifts.filter(
      lift => lift.exercise_id && lift.training_max && parseFloat(lift.training_max) > 0
    );

    if (validLifts.length === 0) {
      setMessage({ type: 'error', text: 'At least one lift with training max is required' });
      return;
    }

    try {
      const programData = {
        name: programName,
        type: '531',
        start_date: new Date().toISOString().split('T')[0],
        is_active: programs.length === 0 ? 1 : 0, // Auto-activate if first program
        lifts: validLifts.map(lift => ({
          exercise_id: parseInt(lift.exercise_id),
          training_max: parseFloat(lift.training_max)
        }))
      };

      await programsAPI.create(programData);
      setMessage({ type: 'success', text: 'Program created successfully!' });
      setShowCreateForm(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error creating program:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to create program' });
    }
  };

  const handleDeleteProgram = async (id) => {
    if (!confirm('Are you sure you want to delete this program?')) {
      return;
    }

    try {
      await programsAPI.delete(id);
      setMessage({ type: 'success', text: 'Program deleted successfully' });
      await loadData();
    } catch (error) {
      console.error('Error deleting program:', error);
      setMessage({ type: 'error', text: 'Failed to delete program' });
    }
  };

  const handleSetActive = async (id) => {
    try {
      await programsAPI.update(id, { is_active: 1 });
      setMessage({ type: 'success', text: 'Active program updated' });
      await loadData();
    } catch (error) {
      console.error('Error setting active program:', error);
      setMessage({ type: 'error', text: 'Failed to set active program' });
    }
  };

  const resetForm = () => {
    setProgramName('');
    setSelectedLifts([
      { exercise_id: '', training_max: '' },
      { exercise_id: '', training_max: '' },
      { exercise_id: '', training_max: '' },
      { exercise_id: '', training_max: '' },
    ]);
  };

  const handleLiftChange = (index, field, value) => {
    const newLifts = [...selectedLifts];
    newLifts[index][field] = value;
    setSelectedLifts(newLifts);
  };

  const getExerciseName = (exerciseId) => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    return exercise ? exercise.name : 'Unknown';
  };

  // Suggest main lifts for quick selection
  const mainLifts = exercises.filter(ex => 
    ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift', 'Barbell Overhead Press'].includes(ex.name)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Training Programs</h1>
          <p className="mt-2 text-gray-600">Manage your 5/3/1 Boring But Big programs</p>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Create Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New Program
          </button>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create 5/3/1 BBB Program</h2>
            
            <form onSubmit={handleCreateProgram} className="space-y-6">
              {/* Program Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 5/3/1 BBB - Cycle 1"
                  required
                />
              </div>

              {/* Lifts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Lifts (select up to 4)
                </label>
                <div className="space-y-3">
                  {selectedLifts.map((lift, index) => (
                    <div key={index} className="flex gap-3">
                      <select
                        value={lift.exercise_id}
                        onChange={(e) => handleLiftChange(index, 'exercise_id', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select exercise...</option>
                        <optgroup label="Main Lifts (Recommended)">
                          {mainLifts.map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="All Exercises">
                          {exercises.filter(ex => !mainLifts.find(m => m.id === ex.id)).map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      <input
                        type="number"
                        value={lift.training_max}
                        onChange={(e) => handleLiftChange(index, 'training_max', e.target.value)}
                        placeholder="Training Max"
                        step="2.5"
                        min="0"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Training Max = 90% of your 1RM (one-rep max)
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Program
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Programs List */}
        {programs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600">No programs yet. Create your first 5/3/1 BBB program!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programs.map(program => (
              <div
                key={program.id}
                className={`bg-white border rounded-lg p-6 ${
                  program.is_active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                      {program.is_active && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Week {program.current_week} · Cycle {program.current_cycle} · {program.type.toUpperCase()}
                    </p>
                    
                    {/* Lifts */}
                    {program.lifts && program.lifts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {program.lifts.map((lift, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {getExerciseName(lift.exercise_id)}: {lift.training_max} lbs
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!program.is_active && (
                      <button
                        onClick={() => handleSetActive(program.id)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Set Active
                      </button>
                    )}
                    <Link
                      to={`/programs/${program.id}`}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteProgram(program.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Programs;