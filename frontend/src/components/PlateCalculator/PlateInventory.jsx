import { useState, useEffect } from 'react';
import { platePresetsAPI } from '../../services/api';

const PlateInventory = () => {
  const [presets, setPresets] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state for creating/editing presets
  const [formData, setFormData] = useState({
    name: '',
    bar_weight: '45',
    plates: {
      '45': '4',
      '25': '4',
      '10': '4',
      '5': '4',
      '2.5': '4'
    }
  });

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await platePresetsAPI.getAll();
      setPresets(response.presets || []);
      
      // Set active preset
      const active = response.presets?.find(p => p.is_active === 1);
      setActivePreset(active || null);
    } catch (err) {
      console.error('Failed to load presets:', err);
      setError('Failed to load plate inventory presets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      setError('');
      setSuccessMessage('');
      await platePresetsAPI.activate(id);
      setSuccessMessage('Preset activated successfully!');
      loadPresets();
    } catch (err) {
      setError(err.message || 'Failed to activate preset');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this preset?')) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      await platePresetsAPI.delete(id);
      setSuccessMessage('Preset deleted successfully!');
      loadPresets();
    } catch (err) {
      setError(err.message || 'Failed to delete preset');
    }
  };

  const handleDuplicate = async (id) => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;

    const newName = prompt(`Enter a name for the duplicate of "${preset.name}":`, `${preset.name} (Copy)`);
    if (!newName || !newName.trim()) return;

    try {
      setError('');
      setSuccessMessage('');
      await platePresetsAPI.duplicate(id, newName);
      setSuccessMessage('Preset duplicated successfully!');
      loadPresets();
    } catch (err) {
      setError(err.message || 'Failed to duplicate preset');
    }
  };

  const startCreate = () => {
    setFormData({
      name: '',
      bar_weight: '45',
      plates: {
        '45': '4',
        '25': '4',
        '10': '4',
        '5': '4',
        '2.5': '4'
      }
    });
    setIsCreating(true);
    setIsEditing(false);
    setError('');
  };

  const startEdit = (preset) => {
    setFormData({
      name: preset.name,
      bar_weight: preset.bar_weight.toString(),
      plates: Object.keys(preset.plates).reduce((acc, key) => {
        acc[key] = preset.plates[key].toString();
        return acc;
      }, {})
    });
    setEditingId(preset.id);
    setIsEditing(true);
    setIsCreating(false);
    setError('');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validate
    if (!formData.name.trim()) {
      setError('Please enter a preset name');
      return;
    }

    // Convert form data to proper format
    const plateData = {
      name: formData.name.trim(),
      bar_weight: parseFloat(formData.bar_weight),
      plates: Object.keys(formData.plates).reduce((acc, key) => {
        const count = parseInt(formData.plates[key]);
        if (count > 0) {
          acc[key] = count;
        }
        return acc;
      }, {})
    };

    try {
      if (isCreating) {
        await platePresetsAPI.create(plateData);
        setSuccessMessage('Preset created successfully!');
      } else if (isEditing) {
        await platePresetsAPI.update(editingId, plateData);
        setSuccessMessage('Preset updated successfully!');
      }
      
      cancelEdit();
      loadPresets();
    } catch (err) {
      setError(err.message || `Failed to ${isCreating ? 'create' : 'update'} preset`);
    }
  };

  const handlePlateChange = (weight, value) => {
    setFormData({
      ...formData,
      plates: {
        ...formData.plates,
        [weight]: value
      }
    });
  };

  const addCustomPlate = () => {
    const weight = prompt('Enter plate weight (e.g., 35, 15, 1):');
    if (!weight || isNaN(parseFloat(weight))) return;
    
    const count = prompt('Enter quantity:', '2');
    if (!count || isNaN(parseInt(count))) return;

    setFormData({
      ...formData,
      plates: {
        ...formData.plates,
        [parseFloat(weight)]: parseInt(count)
      }
    });
  };

  const removePlate = (weight) => {
    const newPlates = { ...formData.plates };
    delete newPlates[weight];
    setFormData({
      ...formData,
      plates: newPlates
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading plate inventories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Plate Inventories</h2>
            <p className="text-sm text-gray-600 mt-1">
              Save multiple plate setups for different gyms or equipment
            </p>
          </div>
          {!isCreating && !isEditing && (
            <button
              onClick={startCreate}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm md:text-base whitespace-nowrap"
            >
              + New Preset
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
            {successMessage}
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || isEditing) && (
          <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
              {isCreating ? 'Create New Preset' : 'Edit Preset'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Preset Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Preset Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Home Gym, Commercial Gym"
                  required
                />
              </div>

              {/* Bar Weight */}
              <div>
                <label htmlFor="bar_weight" className="block text-sm font-medium text-gray-700 mb-2">
                  Barbell Weight (lbs) *
                </label>
                <input
                  type="number"
                  id="bar_weight"
                  value={formData.bar_weight}
                  onChange={(e) => setFormData({ ...formData, bar_weight: e.target.value })}
                  step="0.5"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Available Plates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Available Plates (per side)
                  </label>
                  <button
                    type="button"
                    onClick={addCustomPlate}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Custom
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.keys(formData.plates).sort((a, b) => parseFloat(b) - parseFloat(a)).map((weight) => (
                    <div key={weight} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                      <label className="text-sm font-medium text-gray-700 min-w-[60px]">
                        {weight} lbs
                      </label>
                      <input
                        type="number"
                        value={formData.plates[weight]}
                        onChange={(e) => handlePlateChange(weight, e.target.value)}
                        min="0"
                        max="20"
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removePlate(weight)}
                        className="text-red-600 hover:text-red-700 text-lg font-bold px-2"
                        title="Remove this plate weight"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  {isCreating ? 'Create Preset' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Presets List */}
        {!isCreating && !isEditing && (
          <div className="space-y-3">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-base md:text-lg">No plate inventory presets yet</p>
                <p className="text-sm mt-2">Create your first preset to get started!</p>
              </div>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-3 md:p-4 rounded-lg border-2 transition-colors ${
                    preset.is_active
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Preset Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base md:text-lg font-semibold text-gray-900">{preset.name}</h3>
                        {preset.is_active === 1 && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-gray-600 space-y-1">
                        <p>Bar: {preset.bar_weight} lbs</p>
                        <p className="break-words">
                          Plates: {Object.entries(preset.plates)
                            .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                            .map(([weight, count]) => `${count}×${weight}`)
                            .join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {!preset.is_active && (
                        <button
                          onClick={() => handleActivate(preset.id)}
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded transition-colors whitespace-nowrap"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(preset)}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs md:text-sm font-medium rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(preset.id)}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs md:text-sm font-medium rounded transition-colors"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={presets.length === 1}
                        title={presets.length === 1 ? 'Cannot delete the only preset' : 'Delete preset'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlateInventory;