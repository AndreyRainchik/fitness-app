import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';
import ProfileInfo from '../components/Profile/ProfileInfo';
import BodyweightChart from '../components/Profile/BodyweightChart';
import BodyweightLog from '../components/Profile/BodyweightLog';
import SecuritySettings from '../components/Profile/SecuritySettings';
import Layout from '../components/Layout/Layout';

function Profile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'bodyweight', 'security'

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await profileAPI.getProfile();
      setProfile(response.user);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
      console.error('Profile fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setProfile(updatedUser);
  };

  const handleBodyweightUpdate = () => {
    // Refresh profile to get latest bodyweight
    fetchProfile();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow p-8 max-w-md">
            <div className="text-red-600 text-center mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold">Error Loading Profile</h2>
            </div>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <button
              onClick={fetchProfile}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <p className="text-gray-600">No profile data available</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 py-4 md:py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
            <p className="text-sm md:text-base text-gray-600">Manage your account settings and track your progress</p>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow mb-4 md:mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'info'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Profile Info
                </button>
                <button
                  onClick={() => setActiveTab('bodyweight')}
                  className={`px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'bodyweight'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Bodyweight
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'security'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Security
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'info' && (
              <ProfileInfo user={profile} onUpdate={handleProfileUpdate} />
            )}

            {activeTab === 'bodyweight' && (
              <div className="space-y-6">
                <BodyweightChart units={profile.units} />
                <BodyweightLog 
                  units={profile.units} 
                  onLogAdded={handleBodyweightUpdate}
                />
              </div>
            )}

            {activeTab === 'security' && (
              <SecuritySettings 
                currentEmail={profile.email}
                onEmailUpdate={handleProfileUpdate}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Profile;