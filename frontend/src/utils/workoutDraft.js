import { useSyncExternalStore } from 'react';

/**
 * The in-progress Active Workout, saved to localStorage so it survives
 * reloads, navigating away, and the phone killing the tab.
 *
 * Shape: {
 *   values: { name, date, notes, exercises },   // WorkoutEditor state
 *   timer: { startedAt, pausedAt, pausedMs },    // see workoutElapsedMs
 *   fromTemplate: boolean,
 *   updatedAt: number
 * }
 */
const KEY = 'activeWorkoutDraft';
const EVENT = 'active-workout-draft';

let cachedRaw;
let cachedDraft = null;

export function loadDraft() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  // useSyncExternalStore needs a stable object while the data is unchanged
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedDraft = raw ? JSON.parse(raw) : null;
    } catch {
      cachedDraft = null;
    }
  }
  return cachedDraft;
}

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage full or blocked: the workout still works, it just won't survive a reload
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** The current draft (or null); re-renders when it is saved or cleared. */
export function useWorkoutDraft() {
  return useSyncExternalStore(subscribe, loadDraft, () => null);
}

/** Fresh timer state, running from now. */
export function newTimer(now = Date.now()) {
  return { startedAt: now, pausedAt: null, pausedMs: 0 };
}

/** Milliseconds of training time, not counting pauses. */
export function workoutElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const end = timer.pausedAt ?? now;
  return Math.max(0, end - timer.startedAt - (timer.pausedMs || 0));
}

export function pauseTimer(timer, now = Date.now()) {
  return timer.pausedAt ? timer : { ...timer, pausedAt: now };
}

export function resumeTimer(timer, now = Date.now()) {
  if (!timer.pausedAt) return timer;
  return { ...timer, pausedAt: null, pausedMs: (timer.pausedMs || 0) + (now - timer.pausedAt) };
}

export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
