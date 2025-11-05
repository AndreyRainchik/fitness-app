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
- Create authentication components
- Build API service layer
- Create layout components
- Implement dashboard

## Available Routes:
- `/` - Home page (landing)
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Main dashboard (protected)
- `/workouts` - Workout history (protected)
- `/analytics` - Analytics & charts (protected)
- `/program` - Training programs (protected)

See [ROUTES.md](./src/ROUTES.md) for detailed route documentation.

## Dependencies Installed:
- react: ^19.1.1
- react-dom: ^19.1.1
- react-router-dom: ^7.9.5
- tailwindcss: ^3.4.1 (stable v3)
- postcss: ^8.5.6
- autoprefixer: ^10.4.21
- vite: ^7.2.0