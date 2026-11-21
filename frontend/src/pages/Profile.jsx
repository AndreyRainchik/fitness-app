import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import ProfileInfo from '../components/Profile/ProfileInfo';
import BodyweightChart from '../components/Profile/BodyweightChart';
import BodyweightLog from '../components/Profile/BodyweightLog';
import SecuritySettings from '../components/Profile/SecuritySettings';
import PlateInventory from '../components/PlateCalculator/PlateInventory.jsx';
import HevyConnectionCard from '../components/Hevy/HevyConnectionCard';
import HevyWeightSyncCard from '../components/Hevy/HevyWeightSyncCard';
import { hevyAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import { Button, EmptyState, LoadingState, PageHeader, Tabs } from '../components/ui';

const TABS = [
  { id: 'info', label: 'Profile Info' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'security', label: 'Security' },
  { id: 'plates', label: 'Plates' },
  { id: 'integrations', label: 'Integrations' },
];

/** Connected services (currently just Hevy). */
function IntegrationsTab() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    hevyAPI.getStatus().then(setStatus).catch((err) => setError(err.message || 'Could not load integrations'));
  }, []);

  if (error) return <EmptyState tone="error" title="Couldn't load integrations" description={error} />;
  if (!status) return <LoadingState label="Loading integrations..." />;
  return <HevyConnectionCard status={status} onChange={setStatus} showImportLink />;
}

/**
 * Bodyweight chart and log, plus sending entries to Hevy when Hevy is
 * connected.
 */
function BodyweightTab({ units, onLogChanged }) {
  // null until loaded; stays null when Hevy isn't connected
  const [hevyWeight, setHevyWeight] = useState(null);

  const loadHevyWeight = useCallback(async () => {
    try {
      const status = await hevyAPI.getStatus();
      if (!status.connected || status.key_readable === false) return setHevyWeight(null);
      setHevyWeight(await hevyAPI.getWeightStatus());
    } catch {
      // Hevy status is extra here; the bodyweight log still works without it
      setHevyWeight(null);
    }
  }, []);

  useEffect(() => { loadHevyWeight(); }, [loadHevyWeight]);

  // Each date's latest entry is the one Hevy gets
  const hevyStatusByLogId = useMemo(
    () => new Map((hevyWeight?.entries ?? []).map((e) => [e.log_id, e.status])),
    [hevyWeight]
  );

  return (
    <div className="space-y-6">
      <BodyweightChart units={units} />
      {hevyWeight && <HevyWeightSyncCard weight={hevyWeight} onChange={setHevyWeight} />}
      <BodyweightLog
        units={units}
        hevyStatusByLogId={hevyWeight ? hevyStatusByLogId : null}
        onLogAdded={() => { onLogChanged(); loadHevyWeight(); }}
      />
    </div>
  );
}

function Profile() {
  const location = useLocation();
  const navigate = useNavigate();

  // A link to /profile#bodyweight (e.g. the Dashboard's "Add Bodyweight")
  // opens that tab directly
  const [activeTab, setActiveTab] = useState(() => {
    const fromHash = location.hash.replace('#', '');
    return TABS.some((t) => t.id === fromHash) ? fromHash : 'info';
  });
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await profileAPI.getProfile();
      setProfile(response.user);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Keep the URL in sync so the tab survives a reload or can be linked to
    navigate({ hash: tab === 'info' ? '' : tab }, { replace: true });
  };

  // Refresh after a bodyweight entry so the profile's current bodyweight updates
  const handleBodyweightUpdate = () => fetchProfile();

  let content;
  if (isLoading && !profile) {
    content = <LoadingState label="Loading profile..." />;
  } else if (error && !profile) {
    content = (
      <EmptyState
        tone="error"
        title="Couldn't load your profile"
        description={error}
        action={<Button onClick={fetchProfile}>Try Again</Button>}
      />
    );
  } else if (!profile) {
    content = <EmptyState title="No profile data available" />;
  } else {
    content = (
      <>
        <Tabs
          tabs={TABS}
          active={activeTab}
          onChange={handleTabChange}
          label="Profile sections"
          className="mb-6"
        />

        {activeTab === 'info' && <ProfileInfo user={profile} onUpdate={setProfile} />}

        {activeTab === 'bodyweight' && (
          <BodyweightTab units={profile.units} onLogChanged={handleBodyweightUpdate} />
        )}

        {activeTab === 'security' && (
          <SecuritySettings currentEmail={profile.email} onEmailUpdate={setProfile} />
        )}

        {activeTab === 'plates' && <PlateInventory />}

        {activeTab === 'integrations' && <IntegrationsTab />}
      </>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader title="Profile" subtitle="Manage your account settings and track your progress" />
        {content}
      </div>
    </Layout>
  );
}

export default Profile;
