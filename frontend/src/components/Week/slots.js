import { Dumbbell, Footprints, Layers, Moon, Shuffle } from 'lucide-react';

/** What a day can be for, in the order the schedule editor offers them. */
export const SLOTS = [
  { id: 'lift', label: 'Lift', icon: Dumbbell },
  { id: 'cardio', label: 'Cardio', icon: Footprints },
  { id: 'both', label: 'Both', longLabel: 'Lift + cardio', icon: Layers },
  { id: 'rest', label: 'Rest', icon: Moon },
  { id: 'flex', label: 'Flexible', icon: Shuffle },
];

export const slotInfo = (id) => SLOTS.find((s) => s.id === id) ?? SLOTS[4];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 'YYYY-MM-DD' shifted by whole days, without timezone drift. */
export function addDays(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}
