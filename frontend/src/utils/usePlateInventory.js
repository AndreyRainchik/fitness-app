import { useCallback, useEffect, useMemo, useState } from 'react';
import { platePresetsAPI } from '../services/api';

/**
 * The user's plate presets and which one each exercise loads with, fetched
 * once and shared by every component on the page. services/api.js fires
 * PLATE_INVENTORY_CHANGED after any preset change, which drops the cache and
 * refetches.
 *
 * An exercise uses the preset assigned to it (e.g. overhead press on a
 * "Home" set), else the active preset. A preset's numbers are in its own
 * unit (inventory.units), whatever the user's units are.
 */
export const PLATE_INVENTORY_CHANGED = 'plate-inventory-changed';

// Promise<{ presets, activeId, assignments: Map<exerciseId, presetId> }>
let cached = null;

const toInventory = (preset) =>
  preset ? { bar_weight: preset.bar_weight, plates: preset.plates || {}, units: preset.units || 'lbs' } : null;

function loadSetups() {
  if (!cached) {
    // /active first: it creates the default preset for a user who has none
    cached = platePresetsAPI.getActive()
      .then(({ preset: active }) => Promise.all([
        active,
        platePresetsAPI.getAll(),
        // Older servers have no assignments: everything uses the active preset
        platePresetsAPI.getAssignments().catch(() => ({ assignments: [] })),
      ]))
      .then(([active, { presets = [] }, { assignments = [] }]) => {
        const byId = new Map(presets.map((p) => [p.id, p]));
        if (active && !byId.has(active.id)) byId.set(active.id, active);
        return {
          presets: [...byId.values()],
          activeId: active?.id ?? null,
          assignments: new Map(assignments.filter((a) => byId.has(a.preset_id)).map((a) => [a.exercise_id, a.preset_id])),
        };
      })
      .catch((err) => {
        cached = null; // let the next caller retry
        throw err;
      });
  }
  return cached;
}

if (typeof window !== 'undefined') {
  window.addEventListener(PLATE_INVENTORY_CHANGED, () => { cached = null; });
}

/**
 * All plate setups:
 * { presets, activeId, assignedPresetId(exerciseId), presetFor(exerciseId),
 *   inventoryFor(exerciseId), loading, error }.
 * presetFor/inventoryFor give the exercise's preset, else the active one
 * (and the active one when exerciseId is omitted).
 */
export function usePlateSetups() {
  const [state, setState] = useState({ setups: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      loadSetups()
        .then((setups) => { if (!cancelled) setState({ setups, loading: false, error: null }); })
        .catch((error) => { if (!cancelled) setState({ setups: null, loading: false, error }); });
    };
    load();
    window.addEventListener(PLATE_INVENTORY_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PLATE_INVENTORY_CHANGED, load);
    };
  }, []);

  const { setups, loading, error } = state;
  const assignedPresetId = useCallback(
    (exerciseId) => (exerciseId != null ? setups?.assignments.get(Number(exerciseId)) ?? null : null),
    [setups]
  );
  const presetFor = useCallback((exerciseId) => {
    if (!setups) return null;
    const id = assignedPresetId(exerciseId) ?? setups.activeId;
    return setups.presets.find((p) => p.id === id) || null;
  }, [setups, assignedPresetId]);
  const inventoryFor = useCallback((exerciseId) => toInventory(presetFor(exerciseId)), [presetFor]);

  return {
    presets: setups?.presets || [],
    activeId: setups?.activeId ?? null,
    assignedPresetId,
    presetFor,
    inventoryFor,
    loading,
    error,
  };
}

/** { inventory, loading, error } for an exercise's plate preset (the active one when none is given). */
export function usePlateInventory(exerciseId) {
  const { presetFor, loading, error } = usePlateSetups();
  const preset = presetFor(exerciseId);
  const inventory = useMemo(() => toInventory(preset), [preset]);
  return { inventory, loading, error };
}
