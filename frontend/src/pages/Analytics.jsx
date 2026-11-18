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
      <div>
        <PageHeader
          title="Analytics"
          subtitle="Strength, standards and balance"
          actions={(
            <select
              aria-label="Time range"
              value={weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value))}
              className="h-10 w-full px-3 text-sm sm:w-auto"
            >
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
              <option value={24}>Last 24 weeks</option>
              <option value={52}>Last year</option>
            </select>
          )}
        />

        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="Analytics sections" className="mb-6" />

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                <StrengthScoreCard title="Squat" lift={strengthScore?.squat} />
                <StrengthScoreCard title="Bench press" lift={strengthScore?.bench} />
                <StrengthScoreCard title="Deadlift" lift={strengthScore?.deadlift} />
                <StrengthScoreCard title="Overhead press" lift={strengthScore?.ohp} />
              </div>

              {strengthScore?.total > 0 && (
                <Card padding="p-0" className="overflow-hidden">
                  <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-primary-600 to-purple-600 p-5 text-white">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80">Powerlifting total</p>
                      <p className="tabular mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                        {strengthScore.total} <span className="text-base font-medium text-white/80">{units}</span>
                      </p>
                    </div>
                    <p className="text-right text-xs text-white/70">Squat +<br />Bench +<br />Deadlift</p>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Progression Tab */}
          {activeTab === 'progression' && (
            <>
              {/* Lift Selector */}
              <Card padding="p-4">
                <p className="block text-sm font-medium text-gray-700 mb-2" id="lift-picker-label">
                  Lift
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-labelledby="lift-picker-label">
                  {availableLifts.map((lift) => (
                    <Button
                      key={lift.name}
                      size="md"
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