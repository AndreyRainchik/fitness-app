import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workouts from './pages/Workouts';
import Analytics from './pages/Analytics';
import Program from './pages/Program';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes (will add auth later) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/program" element={<Program />} />
        
        {/* Catch-all route for 404 */}
        <Route path="*" element={
          <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-xl text-gray-600 mb-4">Page not found</p>
              <a href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
                ← Go Home
              </a>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;