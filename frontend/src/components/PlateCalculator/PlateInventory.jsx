import { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';

/**
 * PlateInventory Component
 * Allows users to configure their available plates
 */
const PlateInventory = () => {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [barWeight, setBarWeight] = useState(45);
  const [plates, setPlates] = useState({});

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await profileAPI.getPlateInventory();
      setInventory(data);
      setBarWeight(data.bar_weight || 45);
      setPlates(data.plates || {});
    } catch (error) {
      console.error('Error loading plate inventory:', error);
      setMessage({ type: 'error', text: 'Failed to load plate inventory' });
    } finally {
      setLoading(false);
    }
  };

  const handlePlateChange = (weight, count) => {
    setPlates(prev => ({
      ...prev,
      [weight]: parseInt(count) || 0
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const inventoryData = {
        bar_weight: parseFloat(barWeight),
        plates: plates
      };

      await profileAPI.updatePlateInventory(inventoryData);
      setMessage({ type: 'success', text: 'Plate inventory saved successfully!' });
      
      // Reload to confirm
      await loadInventory();
    } catch (error) {
      console.error('Error saving plate inventory:', error);
      setMessage({ type: 'error', text: 'Failed to save plate inventory' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setBarWeight(45);
    setPlates({
      '45': 4,
      '25': 4,
      '10': 4,
      '5': 4,
      '2.5': 4,
      '1': 2,
      '0.75': 2,
      '0.5': 2,
      '0.25': 2
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const commonPlates = ['45', '25', '10', '5', '2.5', '1', '0.75', '0.5', '0.25'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Plate Inventory</h3>
        <p className="mt-1 text-sm text-gray-600">
          Configure your available plates for the plate loading calculator
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Bar Weight */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Barbell Weight (lbs)
        </label>
        <input
          type="number"
          value={barWeight}
          onChange={(e) => setBarWeight(e.target.value)}
          step="0.5"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="45"
        />
        <p className="mt-1 text-xs text-gray-500">
          Standard Olympic barbell is 45 lbs (20 kg)
        </p>
      </div>

      {/* Plates */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Available Plates (pairs)
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Enter the number of <strong>pairs</strong> you have for each weight
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {commonPlates.map(weight => (
            <div key={weight} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {weight} lbs
              </label>
              <input
                type="number"
                value={plates[weight] || 0}
                onChange={(e) => handlePlateChange(weight, e.target.value)}
                min="0"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Inventory'}
        </button>
        <button
          onClick={resetToDefaults}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          💡 How it works
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Enter the number of <strong>pairs</strong> (not individual plates)</li>
          <li>• This will be used to calculate plate loading for your workouts</li>
          <li>• The calculator shows what plates to load on each side</li>
          <li>• Standard home gym typically has 2-4 pairs of each weight</li>
        </ul>
      </div>
    </div>
  );
};

export default PlateInventory;