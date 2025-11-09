import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import logger from './config/logger.config.js';
import { requestLogger, errorLogger, logStartup, logShutdown } from './middleware/logger.js';
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter.js';

// Import routes
import authRoutes from './routes/auth.js';
import exerciseRoutes from './routes/exercises.js';
import workoutRoutes from './routes/workouts.js';
import profileRoutes from './routes/profile.js';
import analyticsRoutes from './routes/analytics.js';
import templateRoutes from './routes/templates.js';
import programRoutes from './routes/programs.js';
import healthRoutes from './routes/health.js';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
try {
  await initDatabase();
  logger.info('✅ Database initialized successfully');
} catch (error) {
  logger.error('❌ Database initialization failed', { error: error.message });
  process.exit(1);
}

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// CORS configuration (simplified for single-origin deployment)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // In single-container mode, CORS is less critical since frontend and backend
    // are served from the same origin, but we'll keep it for API flexibility
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['*']; // Allow all in single-container mode
    
    if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only set HSTS in production with HTTPS
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// ============================================================================
// GENERAL MIDDLEWARE
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting (applied to API routes only, not static files)
if (NODE_ENV === 'production') {
  app.use('/api', rateLimiter);
  logger.info('✅ Rate limiting enabled for API routes');
}

// ============================================================================
// HEALTH CHECK ROUTES (no rate limiting)
// ============================================================================

app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes); // Legacy endpoint

// ============================================================================
// API ROUTES
// ============================================================================

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Fitness Tracker API v1.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    deployment: 'single-container',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      exercises: '/api/exercises',
      workouts: '/api/workouts',
      profile: '/api/profile',
      analytics: '/api/analytics',
      templates: '/api/templates',
      programs: '/api/programs'
    }
  });
});

// Auth routes (with stricter rate limiting)
if (NODE_ENV === 'production') {
  app.use('/api/auth', authRateLimiter, authRoutes);
} else {
  app.use('/api/auth', authRoutes);
}

// Other API routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/programs', programRoutes);

// ============================================================================
// STATIC FILE SERVING (Frontend)
// ============================================================================

// Serve static files from the public directory (built React app)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath, {
  maxAge: '1y', // Cache static assets for 1 year
  etag: true,
  lastModified: true,
}));

// ============================================================================
// SPA FALLBACK - Serve index.html for all non-API routes (React Router)
// ============================================================================

// This must be AFTER all API routes and AFTER static file serving
app.get('*', (req, res) => {
  // Don't serve index.html for API routes (in case of 404)
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Serve index.html for all other routes (React Router will handle)
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Error logger middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({ 
    error: NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  logStartup(PORT, NODE_ENV);
  logger.info(`🚀 Single-container deployment mode`);
  logger.info(`📁 Serving frontend from: ${publicPath}`);
  logger.info(`🔗 Application available at: http://localhost:${PORT}`);
  logger.info(`📡 API available at: http://localhost:${PORT}/api`);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  server.close(() => {
    logShutdown();
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;