import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    };

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

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

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
  };

  const closeUserDropdown = () => {
    setIsUserDropdownOpen(false);
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
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={toggleUserDropdown}
                className="flex items-center space-x-2 text-white hover:text-blue-100 transition duration-200"
              >
                <span className="font-medium">{user?.username || 'Guest User'}</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                  <Link
                    to="/profile"
                    onClick={closeUserDropdown}
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 transition duration-200"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Profile</span>
                    </div>
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={() => {
                      closeUserDropdown();
                      logout();
                      navigate('/login');
                    }}
                    className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 transition duration-200"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
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
              <div className="text-gray-700 text-sm font-medium mb-3">
                {user?.username || 'Guest User'}
              </div>
              <Link
                to="/profile"
                onClick={closeMobileMenu}
                className="block w-full text-left px-4 py-2 mb-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition duration-200"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Profile</span>
                </div>
              </Link>
              <button
                onClick={() => {
                  closeMobileMenu();
                  logout();
                  navigate('/login');
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