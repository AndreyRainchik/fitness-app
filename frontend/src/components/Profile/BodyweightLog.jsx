import React, { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';

function BodyweightLog({ units, onLogAdded }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    weight: '',
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
    units: units || 'lbs'
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    // Update form units when prop changes
    setFormData(prev => ({ ...prev, units: units || 'lbs' }));
  }, [units]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await profileAPI.getBodyweightLogs({ limit: 10 });
      setLogs(response.bodyweightLogs || []);
    } catch (err) {
      console.error('Failed to fetch bodyweight logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

    try {
      await profileAPI.addBodyweightLog(
        parseFloat(formData.weight),
        formData.date,
        formData.units
      );
      
      setSuccessMessage('Bodyweight logged successfully!');
      setFormData({
        weight: '',
        date: new Date().toISOString().split('T')[0],
        units: units || 'lbs'
      });
      setIsAdding(false);
      
      // Refresh logs
      fetchLogs();
      
      // Notify parent component
      if (onLogAdded) {
        onLogAdded();
      }
    } catch (err) {
      setError(err.message || 'Failed to log bodyweight');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bodyweight entry?')) {
      return;
    }

    try {
      await profileAPI.deleteBodyweightLog(id);
      setSuccessMessage('Bodyweight entry deleted');
      fetchLogs();
      
      if (onLogAdded) {
        onLogAdded();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete entry');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Bodyweight Log</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm md:text-base"
          >
            + Add Entry
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {/* Add New Entry Form */}
      {isAdding && (
        <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Log New Bodyweight</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-2">
                  Weight
                </label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="185.5"
                  required
                />
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Save Entry
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setError('');
                  setFormData({
                    weight: '',
                    date: new Date().toISOString().split('T')[0],
                    units: units || 'lbs'
                  });
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Entries List */}
      <div>
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Recent Entries</h3>
        
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading entries...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 text-sm">No bodyweight entries yet. Add your first entry!</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm md:text-base">
                    {log.weight} {log.units}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 truncate">
                    {new Date(log.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="ml-3 text-red-600 hover:text-red-700 text-xs md:text-sm font-semibold whitespace-nowrap"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BodyweightLog;