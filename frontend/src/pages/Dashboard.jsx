import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Card, LoadingState, PageHeader, StatTile } from '../components/ui';
import { analyticsAPI, workoutsAPI } from '../services/api';
import WilksProgressChart from '../components/Dashboard/WilksProgressChart';
import MuscleGroupHeatmap from '../components/Analytics/MuscleGroupHeatmap';

function Dashboard() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const [dashboardData, setDashboardData] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWilksChart, setShowWilksChart] = useState(false);
  const [showMuscleMap, setShowMuscleMap] = useState(false);

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
        <LoadingState label="Loading dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Dashboard" subtitle="Welcome back! Here's your fitness overview." />

      {error && <Alert className="mb-6">{error}</Alert>}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <StatTile label="Total Workouts" value={dashboardData?.totalWorkouts || 0} hint="All time" tone="primary" />
        <StatTile label="This Week" value={dashboardData?.thisWeek || 0} hint="Workouts completed" tone="success" />
        <StatTile label="Current Streak" value={dashboardData?.streak || 0} hint="Days" tone="warning" />
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
                  {pr.weight} {units} × {pr.reps}
                </p>
                <p className="text-sm opacity-90 mt-1">
                  Est. 1RM: {pr.estimated1RM} {units}
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
      <Card className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Button size="lg" to="/workout/active">➕ New Workout</Button>
          <Button size="lg" variant="secondary" to="/profile#bodyweight">⚖️ Add Bodyweight</Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setShowWilksChart(!showWilksChart)}
            aria-pressed={showWilksChart}
          >
            📊 Analytics
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setShowMuscleMap(!showMuscleMap)}
            aria-pressed={showMuscleMap}
          >
            👤 Visualize
          </Button>
        </div>
      </Card>

      {/* Wilks Progress Chart (Toggleable) */}
      {showWilksChart && (
        <div className="mb-8 animate-fadeIn">
          <WilksProgressChart weeks={12} />
        </div>
      )}

      {/* Muscle Group Heatmap (Toggleable) - ADD THIS SECTION */}
      {showMuscleMap && (
        <div className="mb-8 animate-fadeIn">
          <MuscleGroupHeatmap />
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Recent Workouts</h2>
          <Button variant="ghost" size="sm" to="/workouts">View All →</Button>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No workouts yet!</p>
            <p className="text-sm mt-2">Start your first workout to see your progress here.</p>
            <Button className="mt-4" to="/workout/active">Log Your First Workout</Button>
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
                    <span className="text-primary-600 font-medium text-sm">
                      View Details →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Motivational Stats */}
      {dashboardData && dashboardData.summary && (
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
            <h3 className="text-lg font-semibold text-primary-900 mb-2">
              Average per Week
            </h3>
            <p className="text-3xl font-bold text-primary-600">
              {dashboardData.summary.averageWorkoutsPerWeek?.toFixed(1) || 0}
            </p>
            <p className="text-sm text-primary-700 mt-1">workouts</p>
          </div>

          {dashboardData.summary.lastWorkoutDate && (
            <div className="bg-gradient-to-br from-success-50 to-success-100 rounded-lg p-6 border border-success-200">
              <h3 className="text-lg font-semibold text-success-900 mb-2">
                Last Workout
              </h3>
              <p className="text-lg font-bold text-success-600">
                {formatDate(dashboardData.summary.lastWorkoutDate)}
              </p>
              <p className="text-sm text-success-700 mt-1">
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