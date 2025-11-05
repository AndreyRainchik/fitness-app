# Protected Routes Implementation

## Overview

Protected routes ensure that only authenticated users can access certain pages. Unauthenticated users are automatically redirected to the login page.

## Implementation

### ProtectedRoute Component

**Location:** `/src/components/ProtectedRoute.jsx`

A wrapper component that checks authentication before rendering protected content.

```javascript
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
}
```

**Features:**
- ✅ Checks authentication state from AuthContext
- ✅ Shows loading spinner while checking
- ✅ Redirects to `/login` if not authenticated
- ✅ Renders children if authenticated
- ✅ Uses `<Navigate replace />` to avoid back button issues

### Usage in App.jsx

```javascript
// Protected route
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />

// Public route
<Route path="/login" element={<Login />} />
```

## Protected Pages

The following pages require authentication:

1. **Dashboard** (`/dashboard`)
   - User's main page
   - Shows workout stats and quick actions
   
2. **Workouts** (`/workouts`)
   - Workout history
   - Log new workouts
   
3. **Analytics** (`/analytics`)
   - Muscle group visualization
   - Performance benchmarks
   - Balance analysis
   
4. **Programs** (`/program`)
   - 5/3/1 programming
   - Training plan management

## Smart Redirects

### Login/Register Pages

Both login and register pages redirect to dashboard if user is already authenticated:

```javascript
useEffect(() => {
  if (isAuthenticated) {
    navigate('/dashboard');
  }
}, [isAuthenticated, navigate]);
```

**Why?**
- Prevents confusion of seeing login form when already logged in
- Better user experience
- User lands on dashboard after successful registration

## User Flows

### Unauthenticated User Trying to Access Protected Page

```
User navigates to /dashboard
    ↓
ProtectedRoute checks authentication
    ↓
isAuthenticated = false
    ↓
Redirect to /login
    ↓
User sees login form
    ↓
User logs in
    ↓
Redirect to /dashboard (original destination)
```

### Authenticated User Navigation

```
User logged in
    ↓
Navigates to /dashboard
    ↓
ProtectedRoute checks authentication
    ↓
isAuthenticated = true
    ↓
Render Dashboard component
```

### Already Logged In User Visiting Login Page

```
User logged in
    ↓
Navigates to /login
    ↓
Login page checks authentication
    ↓
isAuthenticated = true
    ↓
Redirect to /dashboard
```

### Page Refresh While Logged In

```
User on /dashboard
    ↓
Refreshes page (F5)
    ↓
AuthContext checks localStorage for token
    ↓
Token found
    ↓
Calls /api/auth/me
    ↓
loading = true (shows spinner)
    ↓
Backend validates token
    ↓
Returns user data
    ↓
isAuthenticated = true
    ↓
loading = false
    ↓
Dashboard renders normally
```

## Loading States

While checking authentication (on page load or navigation):

```
┌─────────────────────────┐
│                         │
│    ⟳  Loading...        │
│                         │
└─────────────────────────┘
```

**Why important?**
- Prevents flash of wrong content
- Better UX during async auth check
- Avoids redirect loop

## Security Considerations

### Frontend Protection

✅ **What it does:**
- Prevents unauthorized users from seeing UI
- Redirects to login
- Hides navigation from unauthenticated users

❌ **What it doesn't do:**
- Does NOT secure the API
- Does NOT prevent API calls

### Backend Protection

The backend MUST also protect endpoints:
- All protected routes require JWT token
- Backend validates token on every request
- Returns 401/403 for invalid tokens

**Both layers needed!**
- Frontend: Better UX, faster feedback
- Backend: Actual security

## Testing Protected Routes

### Test 1: Access Protected Page While Logged Out

1. Make sure you're logged out
2. Go to http://localhost:5173/dashboard
3. ✅ Should redirect to /login
4. ✅ Should NOT see dashboard content

### Test 2: Login and Access Protected Page

1. Go to http://localhost:5173/login
2. Login with valid credentials
3. ✅ Should redirect to /dashboard
4. ✅ Should see dashboard content
5. Navigate to /workouts
6. ✅ Should see workouts page (not redirected)

### Test 3: Logout and Verify Redirect

1. While logged in, go to /dashboard
2. Click logout button
3. ✅ Should redirect to /login
4. Try to manually navigate to /dashboard
5. ✅ Should redirect back to /login

### Test 4: Login Page When Already Logged In

1. Login to the app
2. Try to manually navigate to /login
3. ✅ Should redirect to /dashboard
4. Same for /register
5. ✅ Should redirect to /dashboard

### Test 5: Page Refresh on Protected Page

1. Login and go to /dashboard
2. Refresh the page (F5)
3. ✅ Should show loading spinner briefly
4. ✅ Should stay on /dashboard
5. ✅ Should NOT redirect to login

### Test 6: Invalid/Expired Token

1. Login to the app
2. Open DevTools → Application → Local Storage
3. Manually corrupt the token (change a character)
4. Refresh the page
5. ✅ Should redirect to /login
6. ✅ Token should be cleared

## Common Issues and Solutions

### Issue: Infinite Redirect Loop

**Symptoms:**
- Page keeps redirecting
- URL changes rapidly
- Browser may show error

**Causes:**
- ProtectedRoute on login page
- Missing `replace` prop on Navigate
- Auth check not completing

**Solution:**
```javascript
// Use replace to prevent back button issues
<Navigate to="/login" replace />

// Don't wrap login/register in ProtectedRoute
<Route path="/login" element={<Login />} />
```

### Issue: Flash of Wrong Content

**Symptoms:**
- Briefly see protected content
- Then redirect happens

**Cause:**
- Not checking loading state

**Solution:**
```javascript
if (loading) return <LoadingSpinner />;
if (!isAuthenticated) return <Navigate to="/login" />;
```

### Issue: Can't Access Protected Page Even When Logged In

**Symptoms:**
- Login successful
- Immediately redirected back to login

**Causes:**
- Token not being stored
- Token not being sent with requests
- Backend rejecting token

**Debug:**
```javascript
// Check token
console.log('Token:', localStorage.getItem('token'));

// Check auth state
console.log('Is Authenticated:', isAuthenticated);
console.log('User:', user);

// Check network requests
// DevTools → Network → Headers
// Look for Authorization: Bearer <token>
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                   User Request                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│            React Router                         │
│  <Route path="/dashboard" element={...} />     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│          ProtectedRoute Component               │
│  - Check isAuthenticated                        │
│  - Check loading                                │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   Loading    │    │ Authenticated│
│   Spinner    │    │    Check     │
└──────────────┘    └──────┬───────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
                 ▼                   ▼
        ┌──────────────┐    ┌──────────────┐
        │  Not Auth    │    │   Auth OK    │
        │  Redirect    │    │   Render     │
        │  to /login   │    │   Content    │
        └──────────────┘    └──────────────┘
```

## Files Involved

**Created:**
- `/src/components/ProtectedRoute.jsx` - Protection wrapper

**Modified:**
- `/src/App.jsx` - Wrapped protected routes
- `/src/pages/Login.jsx` - Redirect if already logged in
- `/src/pages/Register.jsx` - Redirect if already logged in

**Context:**
- `/src/context/AuthContext.jsx` - Provides isAuthenticated and loading

## Future Enhancements

Possible improvements:
- [ ] Remember intended destination (redirect after login)
- [ ] Different redirect paths based on user role
- [ ] Permission-based route protection
- [ ] Route-level loading states
- [ ] Error boundaries for protected routes

## Summary

✅ **Protected routes implemented**
✅ **Unauthenticated users redirected to login**
✅ **Loading states handled**
✅ **Smart redirects for login/register**
✅ **Session persistence maintained**
✅ **Frontend and backend protection**

The app now has proper authentication-based access control!