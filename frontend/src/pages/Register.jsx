import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Layout/AuthLayout';
import { Alert, Button } from '../components/ui';

function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    bodyweight: '',
    units: 'lbs',
    sex: ''
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
      // Prepare data for API
      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        units: formData.units,
      };

      // Only include bodyweight if provided
      if (formData.bodyweight) {
        userData.bodyweight = parseFloat(formData.bodyweight);
      }

      // Only include sex if provided
      if (formData.sex) {
        userData.sex = formData.sex;
      }

      await register(userData);
      // Success! Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking your training in under a minute."
      footer={<>Already have an account?{' '}<Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">Sign in</Link></>}
    >
        {error && (
          <Alert className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              className="h-11 w-full px-3.5 text-sm"
              placeholder="JohnDoe"
              required
            />
          </div>

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
              name="password"              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              className="h-11 w-full px-3.5 text-sm"
              placeholder="••••••••"
              required
              minLength="6"
            />
          </div>

          <div>
            <label htmlFor="sex" className="block text-sm font-medium text-gray-700 mb-1.5">
              Sex (optional)
            </label>
            <select
              id="sex"
              name="sex"
              value={formData.sex}
              onChange={handleChange}
              className="h-11 w-full px-3.5 text-sm"
            >
              <option value="">Prefer not to say</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Used for strength standards comparison
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bodyweight" className="block text-sm font-medium text-gray-700 mb-1.5">
                Bodyweight (optional)
              </label>
              <input
                type="number"
                id="bodyweight"
                name="bodyweight"
                value={formData.bodyweight}
                onChange={handleChange}
                step="0.1"
                className="h-11 w-full px-3.5 text-sm"
                placeholder="185.5"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="units" className="block text-sm font-medium text-gray-700 mb-1.5">
                Units
              </label>
              <select
                id="units"
                name="units"
                value={formData.units}
                onChange={handleChange}
                className="h-11 w-full px-3.5 text-sm"
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>

          <Button
            size="lg"
            fullWidth
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
    </AuthLayout>
  );
}

export default Register;
