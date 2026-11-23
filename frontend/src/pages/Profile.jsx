import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import ProfileInfo from '../components/Profile/ProfileInfo';
import BodyweightChart from '../components/Profile/BodyweightChart';
import BodyweightLog from '../components/Profile/BodyweightLog';
import SecuritySettings from '../components/Profile/SecuritySettings';
import PlateInventory from '../components/PlateCalculator/PlateInventory.jsx';
import HevyConnectionCard from '../components/Hevy/HevyConnectionCard';
import StravaConnectionCard from '../components/Strava/StravaConnectionCard';
import HeartRateSettings from '../components/Profile/HeartRateSettings';
import HevyWeightSyncCard from '../components/Hevy/HevyWeightSyncCard';
import { hevyAPI, stravaAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import { Button, EmptyState, LoadingState, PageHeader, Tabs } from '../components/ui';

const TABS = [
  { id: 'info', label: 'Profile Info' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'security', label: 'Security' },
  { id: 'heart-rate', label: 'Heart Rate' },
  { id: 'plates', label: 'Plates' },
  { id: 'integrations', label: 'Integrations' },
];

/** Connected services: Strava and Hevy. */
function IntegrationsTab() {
  const [hevy, setHevy] = useState(null);
  const [strava, setStrava] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([hevyAPI.getStatus(), stravaAPI.getStatus()])
      .then(([hevyStatus, stravaStatus]) => {
        setHevy(hevyStatus);
        setStrava(stravaStatus);
      })
      .catch((err) => setError(err.message || 'Could not load integrations'));
  }, []);

  if (error) return <EmptyState tone="error" title="Couldn't load integrations" description={error} />;
  if (!hevy || !strava) return <LoadingState label="Loading integrations..." />;
  return (
    <div className="space-y-6">
      <StravaConnectionCard status={strava} onChange={setStrava} />
      <HevyConnectionCard status={hevy} onChange={setHevy} showImportLink />
    </div>
  );
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

  // A send still running when the server answered finishes in the background:
  // check again shortly so the badge catches up
  const recheckRef = useRef(null);
  useEffect(() => () => clearTimeout(recheckRef.current), []);
  const handleLogChanged = (hevySync) => {
    onLogChanged();
    loadHevyWeight();
    if (hevySync?.status === 'pending') {
      clearTimeout(recheckRef.current);
      recheckRef.current = setTimeout(loadHevyWeight, 8000);
    }
  };

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
        onLogAdded={handleLogChanged}
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

        {activeTab === 'heart-rate' && <HeartRateSettings />}
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
