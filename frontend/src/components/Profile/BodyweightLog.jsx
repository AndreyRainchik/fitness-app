import React, { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';
import { getLocalDateString } from '../../utils/dateUtils';
import { Alert, Button, useConfirm } from '../ui';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function BodyweightLog({ units, onLogAdded }) {
  const confirm = useConfirm();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    weight: '',
    date: getLocalDateString(), // Today's date in YYYY-MM-DD
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
        date: getLocalDateString(),
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

  const handleDelete = async (log) => {
    const confirmed = await confirm({
      title: 'Delete bodyweight entry?',
      message: `${log.weight} ${log.units || units} on ${formatDate(log.date)} will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    const id = log.id;

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
          <Button
            onClick={() => setIsAdding(true)}
          >
            + Add Entry
          </Button>
        )}
      </div>

      {error && (
        <Alert className="mb-4">
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert tone="success" className="mb-4">
          {successMessage}
        </Alert>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  max={getLocalDateString()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                type="submit"
              >
                Save Entry
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsAdding(false);
                  setError('');
                  setFormData({
                    weight: '',
                    date: getLocalDateString(),
                    units: units || 'lbs'
                  });
                }}
              >
                Cancel
              </Button>
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
                    {formatDate(log.date)}
                  </p>
                </div>
                <Button
                  variant="danger-subtle"
                  size="sm"
                  className="ml-3"
                  onClick={() => handleDelete(log)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BodyweightLog;