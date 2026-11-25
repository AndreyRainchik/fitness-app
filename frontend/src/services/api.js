import { getLocalDateString } from '../utils/dateUtils';
import { clearDraft } from '../utils/workoutDraft';

/** Fired when the server rejects the stored token (expired, or signed out elsewhere). */
export const AUTH_EXPIRED_EVENT = 'auth-expired';

// The signed-in user as last confirmed by the server, so the app still opens
// signed in when it can't reach the server (offline, gym basement)
const CACHED_USER_KEY = 'authUser';

export function cacheUser(user) {
  try {
    if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch { /* storage blocked: offline sign-in just won't work */ }
}

export function cachedUser() {
  try {
    return JSON.parse(localStorage.getItem(CACHED_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Forget everything about the signed-in user on this device: the token, the
 * cached profile, an unfinished workout, and API responses the service worker
 * cached (it caches by URL, so the next user could be shown them offline).
 */
export function clearSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem(CACHED_USER_KEY);
  } catch { /* ignore */ }
  clearDraft();
  if (typeof caches !== 'undefined') {
    caches.delete('api-cache').catch(() => {});
  }
}

// Tells utils/usePlateInventory.js to refetch the active plate preset
const plateInventoryChanged = (result) => {
  window.dispatchEvent(new Event('plate-inventory-changed'));
  return result;
};

// Determine the base URL based on environment
const getBaseURL = () => {
  // In production (when served from same server), use relative paths
  if (import.meta.env.PROD) {
    return '/api';
  }
  // In development, use the backend server URL
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
};

// API Configuration
const API_BASE_URL = getBaseURL();

/**
 * Generic API call helper
 */
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    // A proxy or crash can answer with HTML or nothing; don't fail on parsing it
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // express-validator routes answer { errors: [{ msg }] } without `error`
      const error = new Error(
        data.error || data.errors?.[0]?.msg || data.message || `Request failed (${response.status})`
      );
      error.status = response.status;
      error.code = data.code;
      error.data = data;
      // The server no longer accepts this token: sign out (AuthContext listens).
      // Not for sign-in itself, where 401 just means a wrong password.
      if (response.status === 401 && token && !endpoint.startsWith('/auth/login')) {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    // fetch itself failed: offline, or the server is down
    if (error instanceof TypeError && error.status === undefined) {
      const offline = new Error("Can't reach the server. Check your connection and try again.");
      offline.offline = true;
      throw offline;
    }
    throw error;
  }
}

/**
 * Authentication API calls
 */
export const authAPI = {
  /**
   * Register a new user
   */
  register: async (userData) => {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // Store token
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    return data;
  },

  /**
   * Login with email and password
   */
  login: async (credentials) => {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // Store token
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    return data;
  },

  /**
   * Get current user info
   */
  getCurrentUser: async () => {
    return await apiCall('/auth/me');
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates) => {
    return await apiCall('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Logout (clear token)
   */
  logout: () => {
    clearSession();
  },
};

/**
 * Exercises API calls
 */
export const exercisesAPI = {
  /**
   * Get all exercises
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return await apiCall(`/exercises?${params}`);
  },

  /**
   * Search exercises
   */
  search: async (query) => {
    return await apiCall(`/exercises/search?q=${encodeURIComponent(query)}`);
  },

  /**
   * Get exercise by ID
   */
  getById: async (id) => {
    return await apiCall(`/exercises/${id}`);
  },

  /**
   * Get muscle groups
   */
  getMuscleGroups: async () => {
    return await apiCall('/exercises/muscle-groups');
  },

  /**
   * Add a custom exercise (private to the user). 409 with { exercise } when
   * they already have one by that name.
   */
  create: async (exercise) => {
    return await apiCall('/exercises', {
      method: 'POST',
      body: JSON.stringify(exercise),
    });
  },

  /** The user's own exercises, each with usage: { sets, templates, programs }. */
  getMine: async () => {
    return await apiCall('/exercises/mine');
  },

  /** Change one of the user's own exercises. */
  update: async (id, exercise) => {
    return await apiCall(`/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(exercise),
    });
  },

  /** Delete one of the user's own exercises (409 with { usage } while it's in use). */
  remove: async (id) => {
    return await apiCall(`/exercises/${id}`, { method: 'DELETE' });
  },
};

/**
 * Workouts API calls
 */
export const workoutsAPI = {
  /**
   * Get all workouts
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return await apiCall(`/workouts?${params}`);
  },

  /**
   * Get workout by ID
   */
  getById: async (id) => {
    return await apiCall(`/workouts/${id}`);
  },
  
  /**
   * Get workout by ID with PR detection
   * Returns workout with PR flags and summary
   */
  getByIdWithPRs: async (id) => {
    return await apiCall(`/workouts/${id}/with-prs`);
  },

  /**
   * Most recent sets logged for an exercise ("last time" hints).
   * Pass excludeWorkoutId when editing so the workout doesn't match itself.
   */
  getLastPerformance: async (exerciseId, excludeWorkoutId) => {
    const params = excludeWorkoutId ? `?exclude=${excludeWorkoutId}` : '';
    return await apiCall(`/workouts/exercise/${exerciseId}/last${params}`);
  },

  /**
   * Create new workout
   */
  create: async (workoutData) => {
    return await apiCall('/workouts', {
      method: 'POST',
      body: JSON.stringify(workoutData),
    });
  },

  /**
   * Update workout
   */
  update: async (id, updates) => {
    return await apiCall(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete workout
   */
  delete: async (id) => {
    return await apiCall(`/workouts/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Add set to workout
   */
  addSet: async (workoutId, setData) => {
    return await apiCall(`/workouts/${workoutId}/sets`, {
      method: 'POST',
      body: JSON.stringify(setData),
    });
  },

  /**
   * Update set
   */
  updateSet: async (setId, updates) => {
    return await apiCall(`/workouts/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete set
   */
  deleteSet: async (setId) => {
    return await apiCall(`/workouts/sets/${setId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Profile API calls
 */
export const profileAPI = {
  /**
   * Get current user's full profile
   */
  getProfile: async () => {
    return await apiCall('/profile');
  },

  /**
   * Update user profile (username, units, sex, bodyweight)
   */
  updateProfile: async (updates) => {
    return await apiCall('/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Change password
   */
  changePassword: async (currentPassword, newPassword) => {
    const data = await apiCall('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    // Changing the password signs out other sessions; this one gets a new token
    if (data.token) localStorage.setItem('token', data.token);
    return data;
  },

  /**
   * Change email
   */
  changeEmail: async (email, currentPassword) => {
    const data = await apiCall('/profile/email', {
      method: 'PUT',
      body: JSON.stringify({ email, currentPassword }),
    });
    if (data.token) localStorage.setItem('token', data.token);
    return data;
  },

  /**
   * Get bodyweight logs
   */
  getBodyweightLogs: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return await apiCall(`/profile/bodyweight?${params}`);
  },

  /**
   * Get latest bodyweight
   */
  getLatestBodyweight: async () => {
    return await apiCall('/profile/bodyweight/latest');
  },

  /**
   * Add new bodyweight log
   */
  addBodyweightLog: async (weight, date, units) => {
    return await apiCall('/profile/bodyweight', {
      method: 'POST',
      body: JSON.stringify({ weight, date, units }),
    });
  },

  /**
   * Update bodyweight log
   */
  updateBodyweightLog: async (id, updates) => {
    return await apiCall(`/profile/bodyweight/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete bodyweight log
   */
  deleteBodyweightLog: async (id) => {
    return await apiCall(`/profile/bodyweight/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get bodyweight trend
   */
  getBodyweightTrend: async (days = 30) => {
    return await apiCall(`/profile/bodyweight/trend?days=${days}`);
  },

  /**
   * Get plate inventory configuration
   */
  getPlateInventory: async () => {
    return await apiCall('/profile/plate-inventory');
  },

  /**
   * Update plate inventory configuration
   */
  updatePlateInventory: async (inventory) => {
    return plateInventoryChanged(await apiCall('/profile/plate-inventory', {
      method: 'PUT',
      body: JSON.stringify(inventory),
    }));
  },

  /**
   * Calculate plates needed for a target weight
   */
  calculatePlates: async (targetWeight) => {
    return await apiCall('/profile/calculate-plates', {
      method: 'POST',
      body: JSON.stringify({ target_weight: targetWeight }),
    });
  },
};

/**
 * Analytics API calls
 */
export const cardioAPI = {
  /** Log a cardio session. Returns { workout } with `cardio` and `metrics`. */
  create: async (session) => {
    return await apiCall('/cardio', { method: 'POST', body: JSON.stringify(session) });
  },

  /** Replace every field of a cardio session. */
  update: async (id, session) => {
    return await apiCall(`/cardio/${id}`, { method: 'PUT', body: JSON.stringify(session) });
  },

  /**
   * Charts, route, time in zones and best efforts for one session (any kind).
   * May take a moment the first time: the data is fetched from Strava.
   */
  getAnalysis: (id) => apiCall(`/cardio/${id}/analysis`),

  /** Heart rate settings: { thresholds, zones, suggestion } */
  getThresholds: () => apiCall('/cardio/thresholds'),
  saveThresholds: (settings) => apiCall('/cardio/thresholds', { method: 'POST', body: JSON.stringify(settings) }),
  deleteThresholds: (id) => apiCall(`/cardio/thresholds/${id}`, { method: 'DELETE' }),

  /** Weekly minutes in each heart rate zone. */
  getZones: (weeks = 12) => apiCall(`/cardio/zones?${new URLSearchParams({ weeks, localDate: getLocalDateString() })}`),

  /** Training load and fitness / fatigue / form curves for the last `weeks` weeks. */
  getLoad: (weeks = 12) => apiCall(`/cardio/load?${new URLSearchParams({ weeks, localDate: getLocalDateString() })}`),

  /** Running records, VDOT and race predictions. */
  getRunning: (weeks = 12) => apiCall(`/cardio/running?${new URLSearchParams({ weeks, localDate: getLocalDateString() })}`),

  /** Weekly minutes by activity type, this week's totals and per-sport totals. */
  getSummary: async (weeks = 12) => {
    const params = new URLSearchParams({ weeks, localDate: getLocalDateString() });
    return await apiCall(`/cardio/summary?${params}`);
  },
};

export const stravaAPI = {
  /** { configured, connected, athlete_name?, last_synced_at?, history_imported?, counts? } */
  getStatus: () => apiCall('/strava/status'),

  /** The strava.com page to send the user to; Strava redirects back to /strava/callback. */
  authorizeUrl: () => apiCall('/strava/authorize', {
    method: 'POST',
    body: JSON.stringify({ redirect_uri: `${window.location.origin}/strava/callback` }),
  }),

  /** Finish connecting with the query parameters Strava redirected back with. */
  exchange: ({ code, state, scope }) => apiCall('/strava/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, state, scope }),
  }),

  /** Import new activities and more history. Resolves { result, status }. */
  sync: () => apiCall('/strava/sync', { method: 'POST' }),

  disconnect: () => apiCall('/strava/connection', { method: 'DELETE' }),
};

export const analyticsAPI = {
  /**
   * Get lift progression data for a specific exercise
   * @param {string} exerciseName - Name of exercise
   * @param {number} weeks - Number of weeks to look back (default: 12)
   */
  getLiftProgression: async (exerciseName, weeks = 12) => {
    const localDate = getLocalDateString();
    return await apiCall(`/analytics/lift-progression/${encodeURIComponent(exerciseName)}?weeks=${weeks}&localDate=${localDate}`);
  },

  /**
   * Get strength score for all main lifts
   * @param {number} weeks - Number of weeks to analyze (default: 12)
   */
  getStrengthScore: async (weeks = 12) => {
    const localDate = getLocalDateString();
    return await apiCall(`/analytics/strength-score?weeks=${weeks}&localDate=${localDate}`);
  },

  /**
   * Get symmetry analysis (balance between lifts)
   * @param {number} weeks - Number of weeks to look back (default: 12)
   */
  getSymmetry: async (weeks = 12) => {
    const localDate = getLocalDateString();
    return await apiCall(`/analytics/symmetry?weeks=${weeks}&localDate=${localDate}`);
  },

  /**
   * The Analytics overview: the last `weeks` weeks compared with the weeks before
   * @param {number} weeks - Length of each period in weeks (default: 12)
   */
  getOverview: (weeks = 12) => apiCall(`/analytics/overview?${new URLSearchParams({ weeks, localDate: getLocalDateString() })}`),

  /**
   * Get dashboard summary stats
   */
  getDashboardSummary: async () => {
    const localDate = getLocalDateString();
    return await apiCall(`/analytics/dashboard-summary?localDate=${localDate}`);
  },
  
  /**
   * Get muscle groups worked in a specific week
   * @param {string} date - ISO date string for any day in the target week
   */
  getMuscleGroupsWeekly: async (date = null) => {
    const params = date ? `?date=${date}` : '';
    return await apiCall(`/analytics/muscle-groups-weekly${params}`);
  },
};

/**
 * Templates API calls
 */
export const templatesAPI = {
  /**
   * Get all templates
   */
  getAll: async () => {
    return await apiCall('/templates');
  },

  /**
   * Get template by ID with all sets
   */
  getById: async (id) => {
    return await apiCall(`/templates/${id}`);
  },

  /**
   * Create new empty template
   */
  create: async (templateData) => {
    return await apiCall('/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  },

  /**
   * Create template from existing workout
   */
  createFromWorkout: async (workoutId, templateData) => {
    return await apiCall(`/templates/from-workout/${workoutId}`, {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  },

  /**
   * Start a new workout from template
   */
  startWorkout: async (templateId, date) => {
    return await apiCall(`/templates/${templateId}/start`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  },

  /**
   * Update template
   */
  update: async (id, updates) => {
    return await apiCall(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete template
   */
  delete: async (id) => {
    return await apiCall(`/templates/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Add set to template
   */
  addSet: async (templateId, setData) => {
    return await apiCall(`/templates/${templateId}/sets`, {
      method: 'POST',
      body: JSON.stringify(setData),
    });
  },

  /**
   * Update template set
   */
  updateSet: async (setId, updates) => {
    return await apiCall(`/templates/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete template set
   */
  deleteSet: async (setId) => {
    return await apiCall(`/templates/sets/${setId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Programs API calls
 */
export const programsAPI = {
  /**
   * Get all programs for the user
   */
  getAll: async () => {
    return await apiCall('/programs');
  },

  /**
   * Get active program
   */
  getActive: async () => {
    return await apiCall('/programs/active');
  },

  /**
   * Get program by ID with all lifts
   */
  getById: async (id) => {
    return await apiCall(`/programs/${id}`);
  },

  /**
   * Get current week's workout for a program
   */
  getCurrentWeek: async (id) => {
    return await apiCall(`/programs/${id}/current-week`);
  },

  /**
   * Create new program
   */
  create: async (programData) => {
    return await apiCall('/programs', {
      method: 'POST',
      body: JSON.stringify(programData),
    });
  },

  /**
   * Update program
   */
  update: async (id, updates) => {
    return await apiCall(`/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete program
   */
  delete: async (id) => {
    return await apiCall(`/programs/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Advance to next week
   * @param {string|number} id - Program id
   * @param {Object<string, string>} adjustmentOverrides - Map of exercise_id ->
   *   adjustment choice (increment_2x | increment_1x | keep | decrement_1x).
   *   Only lifts the user explicitly overrode need to be included.
   */
  advanceWeek: async (id, adjustmentOverrides = {}) => {
    return await apiCall(`/programs/${id}/advance-week`, {
      method: 'POST',
      body: JSON.stringify({ adjustment_overrides: adjustmentOverrides }),
    });
  },

  /**
   * Add lift to program
   */
  addLift: async (id, liftData) => {
    return await apiCall(`/programs/${id}/lifts`, {
      method: 'POST',
      body: JSON.stringify(liftData),
    });
  },

  /**
   * Update lift training max
   */
  updateLift: async (id, exerciseId, trainingMax) => {
    return await apiCall(`/programs/${id}/lifts/${exerciseId}`, {
      method: 'PUT',
      body: JSON.stringify({ training_max: trainingMax }),
    });
  },

  /**
   * Remove lift from program
   */
  removeLift: async (id, exerciseId) => {
    return await apiCall(`/programs/${id}/lifts/${exerciseId}`, {
      method: 'DELETE',
    });
  },

    /**
   * Set or update status for a lift in the current week
   * @param {number} programId - Program ID
   * @param {number} exerciseId - Exercise ID
   * @param {string} status - Status: 'completed', 'failed', or 'skipped'
   * @param {string} notes - Optional notes
   * @param {number|null} amrapReps - Reps achieved on the AMRAP set (optional)
   */
  setLiftStatus: async (programId, exerciseId, status, notes = null, amrapReps = null) => {
    return await apiCall(`/programs/${programId}/lifts/${exerciseId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes, amrap_reps: amrapReps }),
    });
  },

  /**
   * Clear status for a lift in the current week
   * @param {number} programId - Program ID
   * @param {number} exerciseId - Exercise ID
   */
  /** Pause a lift (skipped every week, training max kept) or resume it */
  setLiftPaused: (programId, exerciseId, paused) => apiCall(`/programs/${programId}/lifts/${exerciseId}/pause`, {
    method: 'PUT',
    body: JSON.stringify({ paused }),
  }),

  clearLiftStatus: async (programId, exerciseId) => {
    return await apiCall(`/programs/${programId}/lifts/${exerciseId}/status`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all lift statuses for the current week
   * @param {number} programId - Program ID
   */
  getCurrentWeekStatuses: async (programId) => {
    return await apiCall(`/programs/${programId}/status`);
  },

  /**
   * Get all lift statuses for all weeks (full history)
   * @param {number} programId - Program ID
   */
  getAllStatuses: async (programId) => {
    return await apiCall(`/programs/${programId}/status/all`);
  },

  /**
   * Clear all statuses for the current week
   * @param {number} programId - Program ID
   */
  clearCurrentWeekStatuses: async (programId) => {
    return await apiCall(`/programs/${programId}/status`, {
      method: 'DELETE',
    });
  },
};

/**
 * Plate Inventory Presets API calls
 */
export const platePresetsAPI = {
  /**
   * Get all presets for the user
   */
  getAll: async () => {
    return await apiCall('/plate-presets');
  },

  /**
   * Get the active preset
   */
  getActive: async () => {
    return await apiCall('/plate-presets/active');
  },

  /**
   * Get a specific preset by ID
   */
  getById: async (id) => {
    return await apiCall(`/plate-presets/${id}`);
  },

  /**
   * Create a new preset
   */
  create: async (presetData) => {
    return plateInventoryChanged(await apiCall('/plate-presets', {
      method: 'POST',
      body: JSON.stringify(presetData),
    }));
  },

  /**
   * Update a preset
   */
  update: async (id, updates) => {
    return plateInventoryChanged(await apiCall(`/plate-presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }));
  },

  /**
   * Delete a preset
   */
  delete: async (id) => {
    return plateInventoryChanged(await apiCall(`/plate-presets/${id}`, {
      method: 'DELETE',
    }));
  },

  /**
   * Set a preset as active
   */
  activate: async (id) => {
    return plateInventoryChanged(await apiCall(`/plate-presets/${id}/activate`, {
      method: 'POST',
    }));
  },

  /**
   * Duplicate a preset with a new name
   */
  duplicate: async (id, newName) => {
    return plateInventoryChanged(await apiCall(`/plate-presets/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
    }));
  },
};

/**
 * Hevy import API calls (see backend/src/routes/hevy.js)
 */
export const hevyAPI = {
  /** { connected, key_hint?, hevy_username?, last_synced_at?, key_readable? } */
  getStatus: () => apiCall('/hevy/status'),

  /** Saves the key after Hevy accepts it */
  connect: (apiKey) => apiCall('/hevy/connection', {
    method: 'PUT',
    body: JSON.stringify({ api_key: apiKey }),
  }),

  disconnect: () => apiCall('/hevy/connection', { method: 'DELETE' }),

  /** mode 'all' (every workout, newest first) or 'new' (changed in Hevy since the last import) */
  listWorkouts: (page = 1, mode = 'all') => apiCall(`/hevy/workouts?page=${page}&mode=${mode}`),

  /** { workout: newest Hevy workout with its import status, or null } */
  getLatestWorkout: () => apiCall('/hevy/workouts/latest'),

  /** Exercises the chosen workouts use, with suggested matches */
  preview: (workoutIds) => apiCall('/hevy/preview', {
    method: 'POST',
    body: JSON.stringify({ workout_ids: workoutIds }),
  }),

  /** exercises: { [templateId]: { exercise_id } | { create: {...} } | { skip: true } } */
  importWorkouts: (workoutIds, exercises) => apiCall('/hevy/import', {
    method: 'POST',
    body: JSON.stringify({
      workout_ids: workoutIds,
      exercises,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  }),

  /** { entries: [{ date, log_id, weight, units, status: 'synced'|'not_synced'|'changed', synced_at }], pending_count } */
  getWeightStatus: () => apiCall('/hevy/weight'),

  /** Send bodyweight to Hevy: the given dates, or every date not in Hevy yet */
  syncWeight: (dates) => apiCall('/hevy/weight/sync', {
    method: 'POST',
    body: JSON.stringify(dates ? { dates } : {}),
  }),
};

export default {
  hevy: hevyAPI,
  auth: authAPI,
  exercises: exercisesAPI,
  workouts: workoutsAPI,
  cardio: cardioAPI,
  strava: stravaAPI,
  profile: profileAPI,
  analytics: analyticsAPI,
  templates: templatesAPI,
  programs: programsAPI,
  platePresets: platePresetsAPI,
};