import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import Layout from '../components/Layout/Layout';

function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      const data = await workoutsAPI.getAll();
      setWorkouts(data.workouts || []);
    } catch (err) {
      setError(err.message || 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!window.confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    try {
      await workoutsAPI.delete(workoutId);
      // Remove from state
      setWorkouts(workouts.filter(w => w.id !== workoutId));
    } catch (err) {
      alert('Failed to delete workout: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  return (
    <Layout>
      {/* Header - Improved mobile layout */}
      <header className="mb-8">
        <div className="flex items-start justify-between flex-col sm:flex-row gap-4 sm:gap-0">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Workout History</h1>
            <p className="text-gray-600">View and manage all your workouts</p>
          </div>
          <Link
            to="/workout/new"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-center whitespace-nowrap"
          >
            + New Workout
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading workouts...</p>
        </div>
      ) : workouts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-xl text-gray-600 mb-4">No workouts yet!</p>
          <p className="text-sm text-gray-500 mb-6">Start your first workout to see your progress here.</p>
          <Link
            to="/workout/new"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            Log Your First Workout →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => (
            <div key={workout.id} className="bg-white rounded-lg shadow hover:shadow-md transition duration-200">
              <div className="p-6">
                {/* Card Header - Improved mobile layout */}
                <div className="flex items-start justify-between flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1 w-full">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {workout.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(workout.date)}
                      {workout.duration_minutes > 0 && ` • ${workout.duration_minutes} min`}
                    </p>
                  </div>
                  
                  {/* Actions - Responsive buttons */}
                  <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                    <Link
                      to={`/workout/${workout.id}`}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-center"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id)}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Exercise Summary */}
                {workout.exercises && workout.exercises.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Exercises: {workout.exercises.length}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {workout.exercises.slice(0, 5).map((exercise, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full"
                        >
                          {exercise.name}
                        </span>
                      ))}
                      {workout.exercises.length > 5 && (
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                          +{workout.exercises.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Total Volume */}
                {workout.total_volume > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Total Volume: <span className="font-bold text-gray-900">{Math.round(workout.total_volume).toLocaleString()} lbs</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Workouts;