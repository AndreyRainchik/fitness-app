/**
 * API Service
 * Centralized service for making API calls to the backend
 */

const API_BASE_URL = '/api'; // Proxied by Vite to http://localhost:3000

/**
 * Helper function to make API calls
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

export default {
  auth: authAPI,
  exercises: exercisesAPI,
  workouts: workoutsAPI,
};