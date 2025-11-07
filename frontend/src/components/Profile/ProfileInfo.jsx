import React, { useState } from 'react';
import { profileAPI } from '../../services/api';

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
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="lbs">Pounds (lbs)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Profile Information</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="text-blue-600 hover:text-blue-700 font-semibold text-sm md:text-base"
        >
          Edit
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
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