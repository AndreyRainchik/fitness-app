import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';

function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkout();
  }, [id]);

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      const data = await workoutsAPI.getById(id);
      setWorkout(data.workout);
    } catch (err) {
      setError(err.message || 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    try {
      await workoutsAPI.delete(id);
      navigate('/workouts');
    } catch (err) {
      alert('Failed to delete workout: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const groupSetsByExercise = (sets) => {
    const grouped = {};
    sets.forEach(set => {
      if (!grouped[set.exercise_name]) {
        grouped[set.exercise_name] = [];
      }
      grouped[set.exercise_name].push(set);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </Layout>
    );
  }

  if (error || !workout) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-xl text-red-600 mb-4">Failed to load workout</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/workouts"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← Back to Workouts
          </Link>
        </div>
      </Layout>
    );
  }

  const exerciseGroups = groupSetsByExercise(workout.sets || []);
  const totalVolume = workout.sets?.reduce((sum, set) => sum + (set.weight * set.reps), 0) || 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/workouts"
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Workouts
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {workout.name}
              </h1>
              <p className="text-gray-600">
                {formatDate(workout.date)}
                {workout.duration > 0 && ` • ${workout.duration} minutes`}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to={`/workouts/${id}/edit`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                Edit Workout
              </Link>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                Delete Workout
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
              {Object.keys(exerciseGroups).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Sets</p>
            <p className="text-3xl font-bold text-orange-600">
              {workout.sets?.length || 0}
            </p>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-6">
          {Object.entries(exerciseGroups).map(([exercise_name, sets], index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {exercise_name}
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
                    {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                      <tr key={set.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-900">{set.set_number}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.weight}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{set.reps}</td>
                        <td className="py-3 px-3 text-gray-900">{set.rpe || '-'}</td>
                        <td className="py-3 px-3 text-gray-600">{set.weight * set.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-3 px-3 text-gray-700" colSpan="4">Subtotal</td>
                      <td className="py-3 px-3 text-gray-900">
                        {sets.reduce((sum, set) => sum + (set.weight * set.reps), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* No Sets Message */}
        {workout.sets?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-xl text-gray-600">No sets logged for this workout</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default WorkoutDetail;