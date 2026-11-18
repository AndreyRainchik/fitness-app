import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import PWAPrompt from './components/PWAPrompt';
import FeedbackProvider from './components/ui/FeedbackProvider';

// Pages load on demand: each route is its own chunk, so the login screen
// doesn't download the dashboard, the charts library, or the program screens.
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workouts = lazy(() => import('./pages/Workouts'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Programs = lazy(() => import('./pages/Programs'));
const CurrentWeek = lazy(() => import('./pages/CurrentWeek'));
const NewWorkout = lazy(() => import('./pages/NewWorkout'));
const EditWorkout = lazy(() => import('./pages/EditWorkout'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Templates = lazy(() => import('./pages/Templates'));
const TemplateDetail = lazy(() => import('./pages/TemplateDetail'));
const ActiveWorkout = lazy(() => import('./pages/ActiveWorkout'));

/** Shown while a page's code downloads (usually a few milliseconds). */
function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-100 border-t-primary-600" aria-label="Loading" />
    </div>
  );
}

/**
 * Once signed in and the browser is idle, fetch the pages people open most
 * so tapping a tab doesn't wait on the network.
 */
function usePrefetchMainPages() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const prefetch = () => {
      import('./pages/Dashboard');
      import('./pages/Workouts');
      import('./pages/ActiveWorkout');
      import('./pages/WorkoutDetail');
      import('./pages/CurrentWeek');
      import('./pages/Analytics');
    };
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(prefetch);
    return () => cancel(id);
  }, [isAuthenticated]);
}

function Prefetcher() {
  usePrefetchMainPages();
  return null;
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Router>
        <FeedbackProvider>
        <Prefetcher />
        <Suspense fallback={<PageLoading />}>
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
      </Suspense>
      {/* PWA Installation and Update Prompts - NEW */}
      <PWAPrompt />
        </FeedbackProvider>
    </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;