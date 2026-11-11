import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workoutsAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { setsToExerciseBlocks } from '../utils/workoutPayload';

function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setInitialValues(null);
      setLoadError('');
      try {
        const { workout } = await workoutsAPI.getById(id);
        if (cancelled) return;
        setInitialValues({
          name: workout.name || '',
          date: workout.date,
          notes: workout.notes || '',
          // keepIds: existing sets are updated in place rather than re-created
          exercises: setsToExerciseBlocks(workout.sets, { keepIds: true })
        });
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load workout');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async ({ name, date, notes, sets }) => {
    // Updates the workout and replaces its set list in one request
    await workoutsAPI.update(id, { name, date, notes: notes || null, sets });
    navigate(`/workout/${id}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-0">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Workout</h1>
          <p className="text-sm text-gray-600">Update your workout session</p>
        </header>

        {loadError ? (
          <div role="alert" className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {loadError}
          </div>
        ) : !initialValues ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading workout...</p>
          </div>
        ) : (
          <WorkoutEditor
            key={id}
            initialValues={initialValues}
            onSubmit={handleSave}
            onCancel={() => navigate(`/workout/${id}`)}
            submitLabel="Save Changes"
          />
        )}
      </div>
    </Layout>
  );
}

export default EditWorkout;
