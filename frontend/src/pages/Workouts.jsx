import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  useConfirm,
  useToast
} from '../components/ui';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function Workouts() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const confirm = useConfirm();
  const toast = useToast();

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await workoutsAPI.getAll();
        setWorkouts(data.workouts || []);
      } catch (err) {
        setError(err.message || 'Failed to load workouts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeleteWorkout = async (workout) => {
    const confirmed = await confirm({
      title: 'Delete workout?',
      message: `“${workout.name || 'Untitled workout'}” on ${formatDate(workout.date)} and all its sets will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await workoutsAPI.delete(workout.id);
      setWorkouts((list) => list.filter((w) => w.id !== workout.id));
      toast({ tone: 'success', message: 'Workout deleted' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete workout: ${err.message}` });
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Workout History"
        subtitle="View and manage all your workouts"
        actions={<Button to="/workout/new">+ New Workout</Button>}
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading workouts..." />
      ) : workouts.length === 0 ? (
        !error && (
          <EmptyState
            icon="🏋️"
            title="No workouts yet"
            description="Start your first workout to see your progress here."
            action={<Button to="/workout/new">Log Your First Workout</Button>}
          />
        )
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => (
            <Card key={workout.id} className="hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                    <Link to={`/workout/${workout.id}`} className="hover:text-primary-700">
                      {workout.name || 'Untitled workout'}
                    </Link>
                  </h2>
                  <p className="text-sm text-gray-500">
                    {formatDate(workout.date)}
                    {workout.duration_minutes > 0 && ` • ${workout.duration_minutes} min`}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                  <Button variant="secondary" to={`/workout/${workout.id}`} className="flex-1 sm:flex-none">
                    View
                  </Button>
                  <Button
                    variant="danger-subtle"
                    onClick={() => handleDeleteWorkout(workout)}
                    className="flex-1 sm:flex-none"
                    aria-label={`Delete ${workout.name || 'workout'}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {workout.exercises?.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Exercises: {workout.exercises.length}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {workout.exercises.slice(0, 5).map((exercise) => (
                      <span
                        key={exercise.name}
                        className="inline-block bg-primary-50 text-primary-800 text-xs font-medium px-3 py-1 rounded-full"
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

              {workout.total_volume > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Total Volume:{' '}
                    <span className="font-bold text-gray-900">
                      {Math.round(workout.total_volume).toLocaleString()} {units}
                    </span>
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Workouts;
