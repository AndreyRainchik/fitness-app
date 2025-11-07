import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { analyticsAPI, workoutsAPI } from '../services/api';
import WilksProgressChart from '../components/Dashboard/WilksProgressChart';

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWilksChart, setShowWilksChart] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch dashboard summary and recent workouts in parallel
      const [summaryData, workoutsData] = await Promise.all([
        analyticsAPI.getDashboardSummary(),
        workoutsAPI.getAll({ limit: 5 })
      ]);

      setDashboardData(summaryData);
      setRecentWorkouts(workoutsData.workouts || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const getWorkoutSummary = (workout) => {
    // This would ideally come from the API, but we can show a simple summary
    return workout.name || 'Workout';
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your fitness overview.</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Workouts</h3>
          <p className="text-4xl font-bold text-blue-600">
            {dashboardData?.totalWorkouts || 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">This Week</h3>
          <p className="text-4xl font-bold text-green-600">
            {dashboardData?.thisWeek || 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Workouts completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Current Streak</h3>
          <p className="text-4xl font-bold text-orange-600">
            {dashboardData?.streak || 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Days</p>
        </div>
      </div>

      {/* Recent PRs */}
      {dashboardData?.recentPRs && dashboardData.recentPRs.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-4">🏆 Recent PRs</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.recentPRs.slice(0, 3).map((pr, index) => (
              <div key={index} className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                <p className="font-semibold text-lg mb-1">{pr.exercise}</p>
                <p className="text-2xl font-bold">
                  {pr.weight} lbs × {pr.reps}
                </p>
                <p className="text-sm opacity-90 mt-1">
                  Est. 1RM: {pr.estimated1RM} lbs
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {formatDate(pr.date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/workout/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
          >
            ➕ New Workout
          </Link>
          <Link
            to="/profile#bodyweight"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
          >
            ⚖️ Add Bodyweight
          </Link>
          <button
            onClick={() => setShowWilksChart(!showWilksChart)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
          >
            📊 Analytics
          </button>
          <Link
            to="/program"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
          >
            📅 Programs
          </Link>
        </div>
      </div>

      {/* Wilks Progress Chart (Toggleable) */}
      {showWilksChart && (
        <div className="mb-8 animate-fadeIn">
          <WilksProgressChart weeks={12} />
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Recent Workouts</h2>
          <Link
            to="/workouts"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All →
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No workouts yet!</p>
            <p className="text-sm mt-2">Start your first workout to see your progress here.</p>
            <Link
              to="/workout/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-semibold"
            >
              Log Your First Workout →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <Link
                key={workout.id}
                to={`/workout/${workout.id}`}
                className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {getWorkoutSummary(workout)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatDate(workout.date)}
                      {workout.duration_minutes > 0 && (
                        <span className="ml-2">• {workout.duration_minutes} min</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                      View Details →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Motivational Stats */}
      {dashboardData && dashboardData.summary && (
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Average per Week
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {dashboardData.summary.averageWorkoutsPerWeek?.toFixed(1) || 0}
            </p>
            <p className="text-sm text-blue-700 mt-1">workouts</p>
          </div>

          {dashboardData.summary.lastWorkoutDate && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Last Workout
              </h3>
              <p className="text-lg font-bold text-green-600">
                {formatDate(dashboardData.summary.lastWorkoutDate)}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {Math.floor(
                  (new Date() - new Date(dashboardData.summary.lastWorkoutDate)) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                days ago
              </p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

export default Dashboard;