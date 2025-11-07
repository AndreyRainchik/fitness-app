import React, { useState } from 'react';
import { profileAPI } from '../../services/api';

function SecuritySettings({ currentEmail, onEmailUpdate }) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value
    });
  };

  const handleEmailChange = (e) => {
    setEmailForm({
      ...emailForm,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setIsPasswordLoading(true);

    try {
      await profileAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('Password changed successfully!');
      
      // Clear form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    setIsEmailLoading(true);

    try {
      const response = await profileAPI.changeEmail(emailForm.newEmail);
      setEmailSuccess('Email changed successfully!');
      
      // Clear form
      setEmailForm({ newEmail: '' });
      
      // Call parent's onEmailUpdate to refresh user data
      if (onEmailUpdate) {
        onEmailUpdate(response.user);
      }
    } catch (err) {
      setEmailError(err.message || 'Failed to change email');
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Security Settings</h2>

      {/* Change Password Section */}
      <div className="mb-6 md:mb-8 pb-6 md:pb-8 border-b border-gray-200">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Change Password</h3>

        {passwordError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength="6"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength="6"
            />
          </div>

          <button
            type="submit"
            disabled={isPasswordLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            {isPasswordLoading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Change Email Section */}
      <div>
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Change Email</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-500 mb-1">Current Email</label>
          <p className="text-gray-900">{currentEmail}</p>
        </div>

        {emailError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {emailError}
          </div>
        )}

        {emailSuccess && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {emailSuccess}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-2">
              New Email Address
            </label>
            <input
              type="email"
              id="newEmail"
              name="newEmail"
              value={emailForm.newEmail}
              onChange={handleEmailChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="newemail@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isEmailLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            {isEmailLoading ? 'Changing Email...' : 'Change Email'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SecuritySettings;