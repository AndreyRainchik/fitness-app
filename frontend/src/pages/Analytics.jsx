import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { analyticsAPI } from '../services/api';
import StrengthScoreCard from '../components/Analytics/StrengthScoreCard';
import LiftProgressionChart from '../components/Analytics/LiftProgressionChart';
import SymmetryDisplay from '../components/Analytics/SymmetryDisplay';
import StrengthStandardsTable from '../components/Analytics/StrengthStandardsTable';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState, LoadingState, PageHeader, Tabs } from '../components/ui';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'progression', label: 'Progression' },
  { id: 'standards', label: 'Standards' },
  { id: 'symmetry', label: 'Balance' },
];

function Analytics() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
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
        analyticsAPI.getSymmetry(weeks),
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
        <LoadingState label="Loading analytics..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <EmptyState
          tone="error"
          title="Couldn't load analytics"
          description={error}
          action={<Button onClick={loadAnalyticsData}>Try Again</Button>}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Analytics"
          subtitle="Track your progress, analyze your strength, and identify areas for improvement"
        />

        {/* Time Range Selector */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <label htmlFor="analytics-range" className="text-sm font-medium text-gray-700">Time Range:</label>
          <select
            id="analytics-range"
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value={4}>Last 4 weeks</option>
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={24}>Last 24 weeks</option>
            <option value={52}>Last year</option>
          </select>
        </div>

        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="Analytics sections" className="mb-6" />

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Strength Score Cards */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Your Lifts</h2>
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
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Powerlifting Total</h3>
                  <p className="text-4xl md:text-5xl font-bold mb-2">
                    {strengthScore.total} {units}
                  </p>
                  <p className="text-primary-100">
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
              <Card padding="p-4">
                <p className="block text-sm font-medium text-gray-700 mb-2" id="lift-picker-label">
                  Select Lift to Track:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" role="group" aria-labelledby="lift-picker-label">
                  {availableLifts.map((lift) => (
                    <Button
                      key={lift.name}
                      size="lg"
                      variant={selectedLift === lift.name ? 'primary' : 'secondary'}
                      aria-pressed={selectedLift === lift.name}
                      onClick={() => setSelectedLift(lift.name)}
                    >
                      {lift.label}
                    </Button>
                  ))}
                </div>
              </Card>

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
          <EmptyState
            icon="📊"
            title="No analytics data yet"
            description="Start logging your workouts to see detailed analytics and track your progress."
            action={<Button to="/workout/new">Log Your First Workout</Button>}
          />
        )}
      </div>
    </Layout>
  );
}

export default Analytics;