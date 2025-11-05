import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if a nav link is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  const navLinkClass = (path) => {
    const baseClass = "px-4 py-2 rounded-lg font-medium transition duration-200";
    if (isActive(path)) {
      return `${baseClass} bg-blue-700 text-white`;
    }
    return `${baseClass} text-blue-100 hover:bg-blue-700 hover:text-white`;
  };

  const mobileNavLinkClass = (path) => {
    const baseClass = "block px-4 py-3 font-medium transition duration-200";
    if (isActive(path)) {
      return `${baseClass} bg-blue-700 text-white`;
    }
    return `${baseClass} text-gray-700 hover:bg-blue-50`;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-blue-600 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link to="/dashboard" className="flex items-center space-x-2" onClick={closeMobileMenu}>
            <span className="text-2xl">💪</span>
            <span className="text-white text-xl font-bold">Fitness Tracker</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-2">
            <Link to="/dashboard" className={navLinkClass('/dashboard')}>
              Dashboard
            </Link>
            <Link to="/workouts" className={navLinkClass('/workouts')}>
              Workouts
            </Link>
            <Link to="/analytics" className={navLinkClass('/analytics')}>
              Analytics
            </Link>
            <Link to="/program" className={navLinkClass('/program')}>
              Programs
            </Link>
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-white text-sm">
              <span className="font-medium">Guest User</span>
            </div>
            <button
              onClick={() => {
                // TODO: Implement logout
                alert('Logout functionality will be added with authentication!');
              }}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium transition duration-200"
            >
              Logout
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              // Close icon (X)
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white rounded-lg shadow-lg mb-4 overflow-hidden">
            <nav className="py-2">
              <Link 
                to="/dashboard" 
                className={mobileNavLinkClass('/dashboard')}
                onClick={closeMobileMenu}
              >
                Dashboard
              </Link>
              <Link 
                to="/workouts" 
                className={mobileNavLinkClass('/workouts')}
                onClick={closeMobileMenu}
              >
                Workouts
              </Link>
              <Link 
                to="/analytics" 
                className={mobileNavLinkClass('/analytics')}
                onClick={closeMobileMenu}
              >
                Analytics
              </Link>
              <Link 
                to="/program" 
                className={mobileNavLinkClass('/program')}
                onClick={closeMobileMenu}
              >
                Programs
              </Link>
            </nav>
            <div className="border-t border-gray-200 py-3 px-4">
              <div className="text-gray-700 text-sm mb-3">
                <span className="font-medium">Guest User</span>
              </div>
              <button
                onClick={() => {
                  closeMobileMenu();
                  alert('Logout functionality will be added with authentication!');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;