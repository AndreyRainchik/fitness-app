import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Layout/AuthLayout';
import { Alert, Button } from '../components/ui';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData);
      // Success! Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={<>Don't have an account?{' '}<Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">Sign up</Link></>}
    >
        {error && (
          <Alert className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              className="h-11 w-full px-3.5 text-sm"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              className="h-11 w-full px-3.5 text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            size="lg"
            fullWidth
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
    </AuthLayout>
  );
}

export default Login;
