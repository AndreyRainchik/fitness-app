import { useState, useEffect } from 'react';
import { programsAPI, exercisesAPI } from '../services/api';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

// Program Types Configuration
const PROGRAM_TYPES = {
  '531': {
    id: '531',
    name: '5/3/1 Boring But Big',
    shortName: '5/3/1 BBB',
    description: 'Progressive strength program with submaximal training and high-volume accessory work',
    available: true,
    badge: { bg: 'bg-blue-100', text: 'text-blue-800' }
  },
  'gzclp': {
    id: 'gzclp',
    name: 'GZCL Linear Progression',
    shortName: 'GZCLP',
    description: 'Tier-based linear progression program focusing on compound movements',
    available: false,
    badge: { bg: 'bg-purple-100', text: 'text-purple-800' }
  },
  'starting_strength': {
    id: 'starting_strength',
    name: 'Starting Strength',
    shortName: 'SS',
    description: 'Simple linear progression for novice lifters with focus on basic barbell movements',
    available: true,
    badge: { bg: 'bg-green-100', text: 'text-green-800' }
  },
  'nsuns': {
    id: 'nsuns',
    name: "nSuns LP",
    shortName: 'nSuns',
    description: 'High-volume linear progression with multiple working sets at varying percentages',
    available: false,
    badge: { bg: 'bg-orange-100', text: 'text-orange-800' }
  }
};

const Programs = () => {
  const [programs, setPrograms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form state
  const [selectedProgramType, setSelectedProgramType] = useState('531');
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
      setPrograms(Array.isArray(programsData) ? programsData : []);
      setExercises(exercisesData.exercises || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load programs' });
      setExercises([]);
      setPrograms([]);
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
        type: selectedProgramType,
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
    setSelectedProgramType('531');
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

  const getProgramTypeBadge = (programType) => {
    const type = PROGRAM_TYPES[programType];
    if (!type) return null;
    
    return (
      <span className={`px-2 py-1 ${type.badge.bg} ${type.badge.text} text-xs font-medium rounded`}>
        {type.shortName}
      </span>
    );
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
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Training Programs</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Create and manage your strength training programs</p>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg text-sm ${
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
            className="mb-4 sm:mb-6 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm min-h-[44px] sm:min-h-0"
          >
            + Create New Program
          </button>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Create Training Program</h2>
            
            <form onSubmit={handleCreateProgram} className="space-y-5 sm:space-y-6">
              {/* Program Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.values(PROGRAM_TYPES).map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => type.available && setSelectedProgramType(type.id)}
                      disabled={!type.available}
                      className={`relative p-3 sm:p-4 border-2 rounded-lg text-left transition-all min-h-[80px] ${
                        selectedProgramType === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : type.available
                          ? 'border-gray-200 hover:border-gray-300 active:border-gray-400 bg-white'
                          : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-sm sm:text-base font-semibold ${
                              type.available ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {type.name}
                            </h3>
                            {!type.available && (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                                Coming Soon
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-xs sm:text-sm ${
                            type.available ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {type.description}
                          </p>
                        </div>
                        {selectedProgramType === type.id && type.available && (
                          <div className="flex-shrink-0">
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base min-h-[44px] sm:min-h-0"
                  placeholder={`e.g., ${PROGRAM_TYPES[selectedProgramType]?.shortName} - Cycle 1`}
                  required
                />
              </div>

              {/* Program-Specific Configuration */}
              {selectedProgramType === '531' && PROGRAM_TYPES['531'].available && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Main Lifts (select up to 4)
                  </label>
                  <div className="space-y-3 sm:space-y-4">
                    {selectedLifts.map((lift, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1 sm:hidden">
                            Exercise {index + 1}
                          </label>
                          <select
                            value={lift.exercise_id}
                            onChange={(e) => handleLiftChange(index, 'exercise_id', e.target.value)}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
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
                        </div>
                        <div className="w-full sm:w-40">
                          <label className="block text-xs font-medium text-gray-600 mb-1 sm:hidden">
                            Training Max (lbs)
                          </label>
                          <input
                            type="number"
                            value={lift.training_max}
                            onChange={(e) => handleLiftChange(index, 'training_max', e.target.value)}
                            placeholder="Training Max"
                            step="2.5"
                            min="0"
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    💡 Training Max = 90% of your 1RM (one-rep max)
                  </p>
                </div>
              )}

              {/* Starting Strength Configuration */}
              {selectedProgramType === 'starting_strength' && PROGRAM_TYPES['starting_strength'].available && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Starting Weights
                  </label>
                  <p className="text-xs text-gray-600 mb-4">
                    Enter your current working weight for each lift. The program will auto-progress each session.
                  </p>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Squat */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Squat *
                        </label>
                        <select
                          value={selectedLifts[0]?.exercise_id || ''}
                          onChange={(e) => handleLiftChange(0, 'exercise_id', e.target.value)}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        >
                          <option value="">Select Squat...</option>
                          {exercises.filter(ex => ex.name.includes('Squat')).map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          value={selectedLifts[0]?.training_max || ''}
                          onChange={(e) => handleLiftChange(0, 'training_max', e.target.value)}
                          placeholder="0"
                          step="5"
                          min="0"
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        />
                      </div>
                    </div>

                    {/* Bench Press */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Bench Press *
                        </label>
                        <select
                          value={selectedLifts[1]?.exercise_id || ''}
                          onChange={(e) => handleLiftChange(1, 'exercise_id', e.target.value)}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        >
                          <option value="">Select Bench...</option>
                          {exercises.filter(ex => ex.name.includes('Bench')).map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          value={selectedLifts[1]?.training_max || ''}
                          onChange={(e) => handleLiftChange(1, 'training_max', e.target.value)}
                          placeholder="0"
                          step="5"
                          min="0"
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        />
                      </div>
                    </div>

                    {/* Overhead Press */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Overhead Press *
                        </label>
                        <select
                          value={selectedLifts[2]?.exercise_id || ''}
                          onChange={(e) => handleLiftChange(2, 'exercise_id', e.target.value)}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        >
                          <option value="">Select OHP...</option>
                          {exercises.filter(ex => ex.name.includes('Overhead Press')).map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          value={selectedLifts[2]?.training_max || ''}
                          onChange={(e) => handleLiftChange(2, 'training_max', e.target.value)}
                          placeholder="0"
                          step="5"
                          min="0"
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        />
                      </div>
                    </div>

                    {/* Deadlift */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Deadlift *
                        </label>
                        <select
                          value={selectedLifts[3]?.exercise_id || ''}
                          onChange={(e) => handleLiftChange(3, 'exercise_id', e.target.value)}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        >
                          <option value="">Select Deadlift...</option>
                          {exercises.filter(ex => ex.name.includes('Deadlift')).map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Weight (lbs)
                        </label>
                        <input
                          type="number"
                          value={selectedLifts[3]?.training_max || ''}
                          onChange={(e) => handleLiftChange(3, 'training_max', e.target.value)}
                          placeholder="0"
                          step="5"
                          min="0"
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    💡 Weights auto-increase: +10 lbs for squat/deadlift, +5 lbs for bench/press per session
                  </p>
                </div>
              )}

              {/* Placeholder for future program types */}
              {selectedProgramType !== '531' && selectedProgramType !== 'starting_strength' && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Configuration for {PROGRAM_TYPES[selectedProgramType]?.name} will be available soon.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="submit"
                  disabled={!PROGRAM_TYPES[selectedProgramType]?.available}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm min-h-[44px] sm:min-h-0"
                >
                  Create Program
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors font-medium text-sm min-h-[44px] sm:min-h-0"
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
            <p className="text-sm sm:text-base text-gray-600">No programs yet. Create your first training program!</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {programs.map(program => (
              <div
                key={program.id}
                className={`bg-white border rounded-lg p-4 sm:p-6 ${
                  program.is_active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col gap-4">
                  {/* Program Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{program.name}</h3>
                      {getProgramTypeBadge(program.type)}
                      {program.is_active === 1 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3">
                      Week {program.current_week} · Cycle {program.current_cycle}
                    </p>
                    
                    {/* Lifts */}
                    {program.lifts && program.lifts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
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
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {!program.is_active && (
                      <button
                        onClick={() => handleSetActive(program.id)}
                        className="px-4 py-2.5 sm:py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-300 transition-colors font-medium whitespace-nowrap min-h-[44px] sm:min-h-0"
                      >
                        Set Active
                      </button>
                    )}
                    <Link
                      to={`/programs/${program.id}`}
                      className="flex items-center justify-center px-4 py-2.5 sm:py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium min-h-[44px] sm:min-h-0"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => handleDeleteProgram(program.id)}
                      className="px-4 py-2.5 sm:py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 active:bg-red-300 transition-colors font-medium whitespace-nowrap min-h-[44px] sm:min-h-0"
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