import { useEffect, useState } from 'react';
import { platePresetsAPI } from '../services/api';

/**
 * The active plate preset, fetched once and shared by every component on
 * the page. services/api.js fires PLATE_INVENTORY_CHANGED after any preset
 * change, which drops the cache and refetches.
 */
export const PLATE_INVENTORY_CHANGED = 'plate-inventory-changed';

let cached = null; // Promise<{ bar_weight, plates, units } | null>

function loadInventory() {
  if (!cached) {
    cached = platePresetsAPI.getActive()
      .then(({ preset }) => (preset ? { bar_weight: preset.bar_weight, plates: preset.plates || {}, units: preset.units || 'lbs' } : null))
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

/** { inventory, loading, error } for the active plate preset. */
export function usePlateInventory() {
  const [state, setState] = useState({ inventory: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      loadInventory()
        .then((inventory) => { if (!cancelled) setState({ inventory, loading: false, error: null }); })
        .catch((error) => { if (!cancelled) setState({ inventory: null, loading: false, error }); });
    };
    load();
    window.addEventListener(PLATE_INVENTORY_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PLATE_INVENTORY_CHANGED, load);
    };
  }, []);

  return state;
}
