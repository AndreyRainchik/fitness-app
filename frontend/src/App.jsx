import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import PWAPrompt from './components/PWAPrompt';
import FeedbackProvider from './components/ui/FeedbackProvider';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workouts from './pages/Workouts';
import Analytics from './pages/Analytics';
import Programs from './pages/Programs';
import CurrentWeek from './pages/CurrentWeek';
import NewWorkout from './pages/NewWorkout';
import EditWorkout from './pages/EditWorkout';
import WorkoutDetail from './pages/WorkoutDetail';
import Profile from './pages/Profile';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import ActiveWorkout from './pages/ActiveWorkout';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Router>
        <FeedbackProvider>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/workout/new" element={
          <ProtectedRoute>
            <NewWorkout />
          </ProtectedRoute>
        } />
        <Route path="/workout/active" element={
          <ProtectedRoute>
            <ActiveWorkout />
          </ProtectedRoute>
        } />
        <Route path="/workouts/:id/edit" element={
          <ProtectedRoute>
            <EditWorkout />
          </ProtectedRoute>
        } />
        <Route path="/workout/:id" element={
          <ProtectedRoute>
            <WorkoutDetail />
          </ProtectedRoute>
        } />
        <Route path="/workouts" element={
          <ProtectedRoute>
            <Workouts />
          </ProtectedRoute>
        } />
        <Route path="/templates" element={
          <ProtectedRoute>
            <Templates />
          </ProtectedRoute>
        } />
        <Route path="/templates/:id" element={
          <ProtectedRoute>
            <TemplateDetail />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="/programs" element={
          <ProtectedRoute>
            <Programs />
          </ProtectedRoute>
        } />
        <Route path="/programs/:programId" element={
          <ProtectedRoute>
            <CurrentWeek />
          </ProtectedRoute>
        } />
        <Route path="/current-week" element={
          <ProtectedRoute>
            <CurrentWeek />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        
        {/* Catch-all route for 404 */}
        <Route path="*" element={
          <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
            <div className="text-center">
              <p className="eyebrow mb-3">Error 404</p>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Page not found</h1>
              <p className="text-gray-500 mb-6">That page doesn't exist or has moved.</p>
              <a href="/" className="inline-flex h-10 items-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500">
                Go home
              </a>
            </div>
          </div>
        } />
      </Routes>
      {/* PWA Installation and Update Prompts - NEW */}
      <PWAPrompt />
        </FeedbackProvider>
    </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;