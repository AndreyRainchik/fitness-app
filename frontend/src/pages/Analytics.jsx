import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { analyticsAPI } from '../services/api';
import StrengthScoreCard from '../components/Analytics/StrengthScoreCard';
import LiftProgressionChart from '../components/Analytics/LiftProgressionChart';
import SymmetryDisplay from '../components/Analytics/SymmetryDisplay';
import StrengthStandardsTable from '../components/Analytics/StrengthStandardsTable';

function Analytics() {
  // State for all analytics data
  const [strengthScore, setStrengthScore] = useState(null);
  const [symmetryData, setSymmetryData] = useState(null);
  const [liftProgression, setLiftProgression] = useState({});
  const [selectedLift, setSelectedLift] = useState('Barbell Squat');
  const [weeks, setWeeks] = useState(12);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Load initial data
  useEffect(() => {
    loadAnalyticsData();
  }, [weeks]);

  // Load progression when lift changes
  useEffect(() => {
    if (selectedLift) {
      loadLiftProgression(selectedLift);
    }
  }, [selectedLift, weeks]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load strength score and symmetry in parallel
      const [strengthData, symmetryResult] = await Promise.all([
        analyticsAPI.getStrengthScore(weeks),
        analyticsAPI.getSymmetry(),
      ]);

      setStrengthScore(strengthData);
      setSymmetryData(symmetryResult);

    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadLiftProgression = async (liftName) => {
    try {
      const data = await analyticsAPI.getLiftProgression(liftName, weeks);
      setLiftProgression(prev => ({
        ...prev,
        [liftName]: data.progression
      }));
    } catch (err) {
      console.error(`Failed to load progression for ${liftName}:`, err);
    }
  };

  // Available lifts for progression tracking
  const availableLifts = [
    { name: 'Barbell Squat', label: 'Squat' },
    { name: 'Barbell Bench Press', label: 'Bench Press' },
    { name: 'Barbell Deadlift', label: 'Deadlift' },
    { name: 'Barbell Overhead Press', label: 'OHP' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-xl text-red-600 mb-4">Failed to load analytics</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadAnalyticsData}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-200"
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Track your progress, analyze your strength, and identify areas for improvement
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Time Range:</label>
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={4}>Last 4 weeks</option>
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={24}>Last 24 weeks</option>
            <option value={52}>Last year</option>
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('progression')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'progression'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Progression
            </button>
            <button
              onClick={() => setActiveTab('standards')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'standards'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Standards
            </button>
            <button
              onClick={() => setActiveTab('symmetry')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'symmetry'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Balance
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Strength Score Cards */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Lifts</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">🏋️ Squat</h3>
                    <StrengthScoreCard lift={strengthScore?.squat} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">💪 Bench Press</h3>
                    <StrengthScoreCard lift={strengthScore?.bench} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">⚡ Deadlift</h3>
                    <StrengthScoreCard lift={strengthScore?.deadlift} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">🎯 OHP</h3>
                    <StrengthScoreCard lift={strengthScore?.ohp} />
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              {strengthScore?.total > 0 && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Powerlifting Total</h3>
                  <p className="text-4xl md:text-5xl font-bold mb-2">
                    {strengthScore.total} lbs
                  </p>
                  <p className="text-blue-100">
                    Squat + Bench + Deadlift
                  </p>
                </div>
              )}
            </>
          )}

          {/* Progression Tab */}
          {activeTab === 'progression' && (
            <>
              {/* Lift Selector */}
              <div className="bg-white rounded-lg shadow p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Lift to Track:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableLifts.map((lift) => (
                    <button
                      key={lift.name}
                      onClick={() => setSelectedLift(lift.name)}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        selectedLift === lift.name
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lift.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progression Chart */}
              <LiftProgressionChart
                data={liftProgression[selectedLift]}
                exerciseName={selectedLift}
              />
            </>
          )}

          {/* Standards Tab */}
          {activeTab === 'standards' && (
            <StrengthStandardsTable strengthData={strengthScore} />
          )}

          {/* Symmetry Tab */}
          {activeTab === 'symmetry' && (
            <SymmetryDisplay symmetryData={symmetryData} />
          )}
        </div>

        {/* Empty State */}
        {!strengthScore && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              No Analytics Data Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start logging your workouts to see detailed analytics and track your progress.
            </p>
            <a
              href="/workout/new"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
            >
              Log Your First Workout →
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Analytics;