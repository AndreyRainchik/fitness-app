# Frontend Routes

## Available Routes

### Public Routes (No Authentication Required)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with feature overview and CTA buttons |
| `/login` | Login | User login form |
| `/register` | Register | New user registration form |

### Protected Routes (Will Require Authentication)

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Main user dashboard with stats and quick actions |
| `/workouts` | Workouts | Workout history and management |
| `/analytics` | Analytics | Progress tracking and analysis |
| `/program` | Program | Training program management (5/3/1, etc.) |

### Special Routes

| Route | Page | Description |
|-------|------|-------------|
| `*` | 404 | Catch-all for undefined routes |

## Navigation Flow

```
┌──────────┐
│   Home   │ (/)
└────┬─────┘
     │
     ├──► Login (/login) ─────┐
     │                        │
     └──► Register (/register)┘
                              │
                              ▼
                        ┌──────────┐
                        │Dashboard │ (/dashboard)
                        └────┬─────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
      ┌─────────┐      ┌──────────┐     ┌─────────┐
      │Workouts │      │Analytics │     │ Program │
      └─────────┘      └──────────┘     └─────────┘
```

## Route Implementation

All routes are defined in `src/App.jsx` using React Router v7:

```javascript
<Routes>
  {/* Public */}
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  
  {/* Protected */}
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/workouts" element={<Workouts />} />
  <Route path="/analytics" element={<Analytics />} />
  <Route path="/program" element={<Program />} />
  
  {/* 404 */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

## Future Routes (To Be Added)

- `/workout/new` - Create new workout
- `/workout/:id` - View/edit specific workout
- `/profile` - User profile settings
- `/exercises` - Exercise library browser

## Testing Routes

You can test routes by navigating to:
- http://localhost:5173/ (Home)
- http://localhost:5173/login (Login)
- http://localhost:5173/register (Register)
- http://localhost:5173/dashboard (Dashboard)
- http://localhost:5173/workouts (Workouts)
- http://localhost:5173/analytics (Analytics)
- http://localhost:5173/program (Program)
- http://localhost:5173/nonexistent (404 Page)