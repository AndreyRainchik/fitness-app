import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import ProfileInfo from '../components/Profile/ProfileInfo';
import BodyweightChart from '../components/Profile/BodyweightChart';
import BodyweightLog from '../components/Profile/BodyweightLog';
import SecuritySettings from '../components/Profile/SecuritySettings';
import PlateInventory from '../components/PlateCalculator/PlateInventory.jsx';
import Layout from '../components/Layout/Layout';
import { Button, EmptyState, LoadingState, PageHeader, Tabs } from '../components/ui';

const TABS = [
  { id: 'info', label: 'Profile Info' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'security', label: 'Security' },
  { id: 'plates', label: 'Plates' },
];

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
          <div className="space-y-6">
            <BodyweightChart units={profile.units} />
            <BodyweightLog units={profile.units} onLogAdded={handleBodyweightUpdate} />
          </div>
        )}

        {activeTab === 'security' && (
          <SecuritySettings currentEmail={profile.email} onEmailUpdate={setProfile} />
        )}

        {activeTab === 'plates' && <PlateInventory />}
      </>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader title="My Profile" subtitle="Manage your account settings and track your progress" />
        {content}
      </div>
    </Layout>
  );
}

export default Profile;
