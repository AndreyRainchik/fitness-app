import React, { createContext, useContext, useState, useEffect } from 'react';
import { AUTH_EXPIRED_EVENT, authAPI, cacheUser, cachedUser } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Any request the server rejects for the token (expired, or the password was
  // changed on another device) signs out here
  useEffect(() => {
    const onExpired = () => {
      authAPI.logout();
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const signedIn = (nextUser) => {
    cacheUser(nextUser);
    setUser(nextUser);
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await authAPI.getCurrentUser();
      cacheUser(data.user);
      setUser(data.user);
    } catch (err) {
      if (err.status === 401) {
        // The server rejected the token (the 401 handler already cleared it)
        setUser(null);
      } else {
        // Offline, or the server is down or starting up: stay signed in as the
        // user last seen; requests retry when the connection is back
        console.warn('Could not reach the server to check sign-in:', err);
        setUser(cachedUser());
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setError(null);
      const data = await authAPI.login(credentials);
      signedIn(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const data = await authAPI.register(userData);
      signedIn(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const updateUser = async (updates) => {
    try {
      setError(null);
      const data = await authAPI.updateProfile(updates);
      signedIn(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Re-read the user after a change made elsewhere (e.g. units in Profile)
  const refreshUser = async () => {
    const data = await authAPI.getCurrentUser();
    cacheUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    refreshUser,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;