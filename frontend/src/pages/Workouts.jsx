import React from 'react';
import { Link } from 'react-router-dom';

function Workouts() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Workout History</h1>
          <p className="text-gray-600">View and manage all your workouts</p>
        </header>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <p className="text-xl text-gray-600 mb-4">📋 Workout history coming soon!</p>
            <Link
              to="/dashboard"
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Workouts;