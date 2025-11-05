import React from 'react';
import { Link } from 'react-router-dom';

function Analytics() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">Track your progress and identify areas for improvement</p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">📊 Muscle Groups</h3>
            <p className="text-sm text-gray-600">Weekly training distribution</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">🏆 Benchmarks</h3>
            <p className="text-sm text-gray-600">Compare to standards</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">⚖️ Balance</h3>
            <p className="text-sm text-gray-600">Strength ratios</p>
            <p className="text-xs text-gray-400 mt-2">Coming soon</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <p className="text-xl text-gray-600 mb-4">📈 Advanced analytics coming soon!</p>
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

export default Analytics;