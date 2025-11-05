import React from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your fitness overview.</p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Workouts</h3>
            <p className="text-4xl font-bold text-blue-600">0</p>
            <p className="text-sm text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">This Week</h3>
            <p className="text-4xl font-bold text-green-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Workouts completed</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Current Streak</h3>
            <p className="text-4xl font-bold text-orange-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Days</p>
          </div>
        </div>

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
              to="/workouts"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
            >
              📋 View History
            </Link>
            <Link
              to="/analytics"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
            >
              📊 Analytics
            </Link>
            <Link
              to="/program"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg text-center transition duration-200"
            >
              📅 Programs
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Activity</h2>
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
        </div>
      </div>
    </div>
  );
}

export default Dashboard;