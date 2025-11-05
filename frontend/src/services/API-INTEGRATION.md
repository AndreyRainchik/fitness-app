# API Integration Guide

## Overview

The frontend is now connected to the backend API! Users can register, login, and the app maintains authentication state.

## Architecture

```
Frontend (React)
    ↓
AuthContext (State Management)
    ↓
API Service Layer (services/api.js)
    ↓
Vite Proxy (/api → http://localhost:3000)
    ↓
Backend API (Node.js/Express)
    ↓
SQLite Database
```

## Components

### 1. API Service (`/src/services/api.js`)

Centralized service for all API calls.

**Features:**
- ✅ Automatic token attachment to requests
- ✅ Error handling
- ✅ JSON request/response handling
- ✅ Organized by resource (auth, exercises, workouts)

**Usage Example:**
```javascript
import { authAPI, exercisesAPI, workoutsAPI } from '../services/api';

// Login
const data = await authAPI.login({ email, password });

// Get exercises
const exercises = await exercisesAPI.getAll();

// Create workout
const workout = await workoutsAPI.create({ date, name });
```

**Available APIs:**
- `authAPI` - Authentication (login, register, logout, getCurrentUser, updateProfile)
- `exercisesAPI` - Exercise library (getAll, search, getById, getMuscleGroups)
- `workoutsAPI` - Workout management (getAll, getById, create, update, delete, addSet, updateSet, deleteSet)

### 2. Auth Context (`/src/context/AuthContext.jsx`)

React Context for managing authentication state across the app.

**Features:**
- ✅ User state management
- ✅ Auto-login on page load (if token exists)
- ✅ Token storage in localStorage
- ✅ Login/register/logout functions
- ✅ Loading and error states

**Usage Example:**
```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, login, logout, isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user.username}!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
}
```

**Available Properties:**
- `user` - Current user object (or null)
- `loading` - Boolean indicating if auth check is in progress
- `error` - Error message (or null)
- `isAuthenticated` - Boolean indicating if user is logged in
- `login(credentials)` - Function to log in
- `register(userData)` - Function to register
- `logout()` - Function to log out
- `updateUser(updates)` - Function to update profile

### 3. Updated Pages

#### Login Page (`/src/pages/Login.jsx`)

**Features:**
- ✅ Controlled form with validation
- ✅ Calls `authAPI.login()`
- ✅ Stores JWT token
- ✅ Navigates to dashboard on success
- ✅ Displays error messages
- ✅ Loading state

**Flow:**
1. User enters email and password
2. Submits form
3. API call to `/api/auth/login`
4. Backend validates credentials
5. Returns JWT token + user data
6. Token stored in localStorage
7. User state updated in AuthContext
8. Navigate to `/dashboard`

#### Register Page (`/src/pages/Register.jsx`)

**Features:**
- ✅ Controlled form with all fields
- ✅ Calls `authAPI.register()`
- ✅ Stores JWT token
- ✅ Navigates to dashboard on success
- ✅ Displays error messages
- ✅ Optional bodyweight field

**Flow:**
1. User enters registration details
2. Submits form
3. API call to `/api/auth/register`
4. Backend creates user account
5. Returns JWT token + user data
6. Token stored in localStorage
7. User state updated in AuthContext
8. Navigate to `/dashboard`

#### Header Component (`/src/components/Layout/Header.jsx`)

**Features:**
- ✅ Displays actual username (from auth context)
- ✅ Logout button clears token
- ✅ Navigates to login page on logout
- ✅ Works in desktop and mobile menus

## Authentication Flow

### Initial Page Load

```
1. App starts
2. AuthProvider checks localStorage for token
3. If token exists:
   - Calls /api/auth/me
   - If valid: Sets user state
   - If invalid: Clears token
4. If no token: User is unauthenticated
5. Renders app
```

### Login Flow

```
User → Login Form → Submit
    ↓
authAPI.login({ email, password })
    ↓
POST /api/auth/login
    ↓
Backend validates credentials
    ↓
Returns { token, user }
    ↓
Store token in localStorage
    ↓
Update user state in AuthContext
    ↓
Navigate to /dashboard
```

### Logout Flow

```
User clicks Logout
    ↓
authAPI.logout()
    ↓
Remove token from localStorage
    ↓
Clear user state in AuthContext
    ↓
Navigate to /login
```

### Protected Routes (Future)

```javascript
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
}
```

## Token Management

### Storage
- Tokens stored in `localStorage` under key `'token'`
- Automatically attached to API requests via Authorization header
- Format: `Bearer <token>`

### Expiration
- Tokens expire after 7 days (set in backend)
- Frontend checks token validity on page load
- Invalid/expired tokens are automatically cleared

### Security
- Token only sent via HTTPS in production
- Never logged to console in production
- Cleared on logout
- httpOnly cookies would be more secure (future enhancement)

## Error Handling

### API Errors
```javascript
try {
  await authAPI.login(credentials);
} catch (error) {
  // error.message contains user-friendly message
  setError(error.message);
}
```

### Common Errors:
- "Invalid email or password" - Wrong credentials
- "Email already registered" - Duplicate account
- "API request failed" - Network/server error

## Testing the Integration

### Prerequisites
1. Backend server running on `http://localhost:3000`
2. Frontend dev server running on `http://localhost:5173`

### Test Registration

1. Go to http://localhost:5173/register
2. Fill in form:
   - Username: TestUser
   - Email: test@example.com
   - Password: password123
   - Bodyweight: 185 (optional)
   - Units: lbs
3. Click "Create Account"
4. Should navigate to dashboard
5. Header should show "TestUser"

### Test Login

1. Go to http://localhost:5173/login
2. Enter credentials:
   - Email: test@example.com
   - Password: password123
3. Click "Sign In"
4. Should navigate to dashboard
5. Header should show "TestUser"

### Test Logout

1. While logged in, click "Logout" button
2. Should navigate to login page
3. Header should show "Guest User"
4. Token should be cleared from localStorage

### Test Persistence

1. Login to the app
2. Refresh the page
3. Should remain logged in
4. Username should persist

### Debug Tools

**Check Token:**
```javascript
// In browser console
localStorage.getItem('token')
```

**Check User State:**
```javascript
// Add to any component
console.log('User:', user);
console.log('Is Authenticated:', isAuthenticated);
```

**Check API Calls:**
- Open browser DevTools → Network tab
- Filter by "Fetch/XHR"
- Watch for calls to `/api/auth/*`

## Next Steps

Now that authentication is connected:
1. ✅ Users can register
2. ✅ Users can login
3. ✅ Users can logout
4. ✅ Authentication state persists
5. ⏭️ Ready to build workout logging features
6. ⏭️ Ready to implement protected routes
7. ⏭️ Ready to fetch user-specific data

## Troubleshooting

**Problem:** "Failed to fetch"
- **Solution:** Make sure backend is running on port 3000

**Problem:** "Invalid or expired token"
- **Solution:** Clear localStorage and login again

**Problem:** "CORS error"
- **Solution:** Vite proxy should handle this, check vite.config.js

**Problem:** Token not persisting
- **Solution:** Check browser console for localStorage errors

**Problem:** User data not showing
- **Solution:** Check /api/auth/me endpoint in backend

## Files Created/Modified

**New Files:**
- `/src/services/api.js` - API service layer
- `/src/context/AuthContext.jsx` - Authentication context

**Modified Files:**
- `/src/App.jsx` - Wrapped with AuthProvider
- `/src/pages/Login.jsx` - Connected to API
- `/src/pages/Register.jsx` - Connected to API
- `/src/components/Layout/Header.jsx` - Shows real user, logout works

**Configuration:**
- `/vite.config.js` - API proxy already configured

This completes the frontend-backend integration for authentication! 🎉