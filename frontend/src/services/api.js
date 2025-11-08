// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Generic API call helper
 */
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
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
    localStorage.removeItem('token');
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
    return await apiCall('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /**
   * Change email
   */
  changeEmail: async (email) => {
    return await apiCall('/profile/email', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
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
};

/**
 * Analytics API calls
 */
export const analyticsAPI = {
  /**
   * Get lift progression data for a specific exercise
   * @param {string} exerciseName - Name of exercise
   * @param {number} weeks - Number of weeks to look back (default: 12)
   */
  getLiftProgression: async (exerciseName, weeks = 12) => {
    return await apiCall(`/analytics/lift-progression/${encodeURIComponent(exerciseName)}?weeks=${weeks}`);
  },

  /**
   * Get strength score for all main lifts
   * @param {number} weeks - Number of weeks to analyze (default: 12)
   */
  getStrengthScore: async (weeks = 12) => {
    return await apiCall(`/analytics/strength-score?weeks=${weeks}`);
  },

  /**
   * Get symmetry analysis (balance between lifts)
   */
  getSymmetry: async () => {
    return await apiCall('/analytics/symmetry');
  },

  /**
   * Get dashboard summary stats
   */
  getDashboardSummary: async () => {
    return await apiCall('/analytics/dashboard-summary');
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

export default {
  auth: authAPI,
  exercises: exercisesAPI,
  workouts: workoutsAPI,
  profile: profileAPI,
  analytics: analyticsAPI,
  templates: templatesAPI,
};