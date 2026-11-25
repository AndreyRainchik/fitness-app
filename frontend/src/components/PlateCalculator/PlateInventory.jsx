import { useState, useEffect } from 'react';
import { platePresetsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { unitLabel } from '../../utils/units';
import { Alert, Button, useConfirm, usePrompt } from '../ui';

// A new plate set starts with a common gym's plates in its unit
const DEFAULT_SET = {
  lbs: { bar_weight: '45', plates: { '45': '4', '25': '4', '10': '4', '5': '4', '2.5': '4' } },
  kg: { bar_weight: '20', plates: { '25': '2', '20': '2', '15': '2', '10': '4', '5': '4', '2.5': '2', '1.25': '2' } },
};
const defaultForm = (units) => ({ name: '', units, ...DEFAULT_SET[units] });
const isDefault = (form) => JSON.stringify({ bar_weight: form.bar_weight, plates: form.plates }) === JSON.stringify(DEFAULT_SET[form.units]);

const PlateInventory = () => {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state for creating/editing presets
  const userUnits = useAuth().user?.units === 'kg' ? 'kg' : 'lbs';
  const [formData, setFormData] = useState(() => defaultForm(userUnits));
  const unit = unitLabel(formData.units);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await platePresetsAPI.getAll();
      setPresets(response.presets || []);
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
    const preset = presets.find((p) => p.id === id);
    const confirmed = await confirm({
      title: 'Delete plate preset?',
      message: `“${preset?.name ?? 'This preset'}” will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

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

    const result = await prompt({
      title: 'Duplicate preset',
      fields: [{ name: 'name', label: `Name for the copy of “${preset.name}”`, defaultValue: `${preset.name} (Copy)` }],
      confirmLabel: 'Duplicate'
    });
    const newName = result?.name?.trim();
    if (!newName) return;

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
    setFormData(defaultForm(userUnits));
    setIsCreating(true);
    setIsEditing(false);
    setError('');
  };

  const startEdit = (preset) => {
    setFormData({
      name: preset.name,
      units: preset.units === 'kg' ? 'kg' : 'lbs',
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
      units: formData.units,
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

  const addCustomPlate = async () => {
    const result = await prompt({
      title: 'Add a plate size',
      fields: [
        { name: 'weight', label: 'Plate weight (e.g. 35, 15, 1)', type: 'number', inputMode: 'decimal', step: 'any', min: 0 },
        { name: 'count', label: 'How many', type: 'number', inputMode: 'numeric', defaultValue: '2', min: 1 }
      ],
      confirmLabel: 'Add Plate'
    });
    if (!result) return;
    const { weight, count } = result;
    if (isNaN(parseFloat(weight)) || isNaN(parseInt(count))) return;

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
      <div className="bg-surface rounded-2xl border border-gray-200/80 shadow-card p-4 sm:p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Loading plate inventories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-gray-200/80 shadow-card">
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
            <Button
              fullWidth
              className="sm:w-auto whitespace-nowrap"
              onClick={startCreate}
            >
              + New Preset
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Messages */}
        {error && (
          <Alert className="mb-4  text-sm">
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert tone="success" className="mb-4  text-sm">
            {successMessage}
          </Alert>
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Home Gym, Commercial Gym"
                  required
                />
              </div>

              {/* Plate unit: the numbers on the plates themselves, whatever unit the app shows */}
              <div>
                <label htmlFor="plate_units" className="block text-sm font-medium text-gray-700 mb-2">
                  Plates are in
                </label>
                <select
                  id="plate_units"
                  value={formData.units}
                  onChange={(e) => {
                    const units = e.target.value;
                    // Untouched defaults switch to that unit's common plates
                    setFormData(isDefault(formData) ? { ...formData, units, ...DEFAULT_SET[units] } : { ...formData, units });
                  }}
                  className="h-11 w-full px-3.5"
                >
                  <option value="lbs">Pounds (lbs)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  What's printed on your plates. Weights in {unitLabel(userUnits)} are converted when working out what to load.
                </p>
              </div>

              {/* Bar Weight */}
              <div>
                <label htmlFor="bar_weight" className="block text-sm font-medium text-gray-700 mb-2">
                  Barbell Weight ({unit}) *
                </label>
                <input
                  type="number"
                  id="bar_weight"
                  value={formData.bar_weight}
                  onChange={(e) => setFormData({ ...formData, bar_weight: e.target.value })}
                  step="0.5"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Add Custom
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.keys(formData.plates).sort((a, b) => parseFloat(b) - parseFloat(a)).map((weight) => (
                    <div key={weight} className="flex items-center gap-2 p-2 bg-surface rounded border border-gray-200">
                      <label className="text-sm font-medium text-gray-700 min-w-[60px]">
                        {weight} {unit}
                      </label>
                      <input
                        type="number"
                        value={formData.plates[weight]}
                        onChange={(e) => handlePlateChange(weight, e.target.value)}
                        min="0"
                        max="20"
                        className="h-10 min-w-0 flex-1 px-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removePlate(weight)}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-danger-600 hover:bg-danger-50"
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
                <Button
                  className="flex-1"
                  type="submit"
                >
                  {isCreating ? 'Create Preset' : 'Save Changes'}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
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
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Preset Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base md:text-lg font-semibold text-gray-900">{preset.name}</h3>
                        {preset.is_active === 1 && (
                          <span className="px-2 py-0.5 bg-primary-600 text-white text-xs font-medium rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-gray-600 space-y-1">
                        <p>Bar: {preset.bar_weight} {unitLabel(preset.units)}</p>
                        <p className="break-words">
                          Plates: {Object.entries(preset.plates)
                            .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                            .map(([weight, count]) => `${count}×${weight}`)
                            .join(', ')} {unitLabel(preset.units)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {!preset.is_active && (
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none whitespace-nowrap"
                          onClick={() => handleActivate(preset.id)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => startEdit(preset)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => handleDuplicate(preset.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="danger-subtle"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => handleDelete(preset.id)}
                        disabled={presets.length === 1}
                        title={presets.length === 1 ? 'Cannot delete the only preset' : 'Delete preset'}
                      >
                        Delete
                      </Button>
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