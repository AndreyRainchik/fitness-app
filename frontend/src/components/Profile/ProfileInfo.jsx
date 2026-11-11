import React, { useState } from 'react';
import { profileAPI } from '../../services/api';
import { Alert, Button } from '../ui';

function ProfileInfo({ user, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user.username || '',
    sex: user.sex || '',
    units: user.units || 'lbs',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await profileAPI.updateProfile(formData);
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);
      
      // Call parent's onUpdate to refresh user data
      if (onUpdate) {
        onUpdate(response.user);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original user values
    setFormData({
      username: user.username || '',
      sex: user.sex || '',
      units: user.units || 'lbs',
    });
    setIsEditing(false);
    setError('');
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Edit Profile</h2>
        </div>

        {error && (
          <Alert className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="sex" className="block text-sm font-medium text-gray-700 mb-2">
              Sex
            </label>
            <select
              id="sex"
              name="sex"
              value={formData.sex}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Prefer not to say</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          <div>
            <label htmlFor="units" className="block text-sm font-medium text-gray-700 mb-2">
              Units
            </label>
            <select
              id="units"
              name="units"
              value={formData.units}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="lbs">Pounds (lbs)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Profile Information</h2>
        <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>

      {successMessage && (
        <Alert tone="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Username</label>
          <p className="text-lg text-gray-900">{user.username}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
          <p className="text-lg text-gray-900">{user.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Sex</label>
          <p className="text-lg text-gray-900">
            {user.sex === 'M' ? 'Male' : user.sex === 'F' ? 'Female' : 'Not specified'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Units</label>
          <p className="text-lg text-gray-900">
            {user.units === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
          </p>
        </div>

        {user.currentBodyweight && (
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Current Bodyweight</label>
            <p className="text-lg text-gray-900">
              {user.currentBodyweight.weight} {user.currentBodyweight.units}
              <span className="text-sm text-gray-500 ml-2">
                (as of {new Date(user.currentBodyweight.date).toLocaleDateString('en-us', {timeZone: 'UTC'})})
              </span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Member Since</label>
          <p className="text-lg text-gray-900">
            {new Date(user.created_at).toLocaleDateString('en-us', {timeZone: 'UTC'})}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProfileInfo;