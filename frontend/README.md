# Fitness App Frontend

React-based frontend for the Fitness Tracking application.

## Setup Complete ✅

### Tech Stack:
- **React 18**: Modern UI framework
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Modern JavaScript**: ES6+ features

### Project Structure:
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Auth/        # Login, Register components
│   │   ├── Dashboard/   # Dashboard components
│   │   ├── Workout/     # Workout logging components
│   │   ├── Analytics/   # Analytics & charts
│   │   ├── Program/     # Program management
│   │   └── Layout/      # Layout components (Header, Nav, etc.)
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   ├── context/         # React Context (Auth, App state)
│   ├── utils/           # Helper functions
│   ├── App.jsx          # Main app component ✅
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles with Tailwind ✅
├── public/              # Static assets
├── package.json         # Dependencies ✅
├── vite.config.js       # Vite configuration with API proxy ✅
├── tailwind.config.js   # Tailwind configuration ✅
└── postcss.config.js    # PostCSS configuration ✅
```

### Development Server:
```bash
npm run dev
```
Server runs at: http://localhost:5173

### API Proxy:
All requests to `/api/*` are proxied to `http://localhost:3000` (backend server)

### Build for Production:
```bash
npm run build
```

### Preview Production Build:
```bash
npm run preview
```

## Next Steps:
- ✅ Set up React Router
- ✅ Create basic layout and navigation
- ✅ Connect to backend API
- Build workout logging features
- Implement protected routes
- Add analytics visualizations
- Implement 5/3/1 programming

## API Integration:
The frontend is now connected to the backend API:
- **Authentication**: Login and registration working
- **Token Management**: JWT tokens stored in localStorage
- **Auth Context**: Global authentication state
- **API Service**: Centralized API calls
- **Auto-login**: Persists session across page refreshes

See [API Integration Guide](./src/services/API-INTEGRATION.md) for full documentation.

### Testing Authentication:
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Register at http://localhost:5173/register
4. Login at http://localhost:5173/login
5. See your username in the header!

## Layout & Navigation:
The app uses a consistent layout system for authenticated pages:
- **Header**: Blue navigation bar with logo, menu links, and logout
- **Active Highlighting**: Current page highlighted in navigation
- **Responsive**: Mobile-friendly hamburger menu (☰)
- **Desktop**: Horizontal navigation bar
- **Mobile**: Tap hamburger icon to reveal dropdown menu
- **Footer**: Sticky footer at bottom of page

All authenticated pages (Dashboard, Workouts, Analytics, Programs) use the Layout wrapper component.

See [Layout Documentation](./src/components/Layout/README.md) for details.
See [Mobile Menu Guide](./src/components/Layout/MOBILE-MENU.md) for mobile implementation.

## Available Routes:
- `/` - Home page (landing)
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Main dashboard (protected)
- `/workouts` - Workout history (protected)
- `/analytics` - Analytics & charts (protected)
- `/program` - Training programs (protected)

See [ROUTES.md](./ROUTES.md) for detailed route documentation.

## Dependencies Installed:
- react: ^19.1.1
- react-dom: ^19.1.1
- react-router-dom: ^7.9.5
- tailwindcss: ^3.4.1 (stable v3)
- postcss: ^8.5.6
- autoprefixer: ^10.4.21
- vite: ^7.2.0