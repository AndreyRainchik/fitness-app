import express from 'express';
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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:5173'];
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
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

// Security headers (basic implementation)
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

// Rate limiting (applied to all routes)
if (NODE_ENV === 'production') {
  app.use(rateLimiter);
  logger.info('✅ Rate limiting enabled');
}

// ============================================================================
// HEALTH CHECK ROUTES (no rate limiting)
// ============================================================================

app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes); // Legacy endpoint

// ============================================================================
// API ROUTES
// ============================================================================

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Fitness App API v1.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
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

// Other routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/programs', programRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { 
    method: req.method, 
    path: req.path 
  });
  res.status(404).json({ error: 'Route not found' });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  // Don't expose error details in production
  const errorResponse = {
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  };
  
  // Add stack trace in development
  if (NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let server;

function gracefulShutdown(signal) {
  logShutdown(signal);
  
  if (server) {
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { 
    error: error.message, 
    stack: error.stack 
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { 
    reason: reason,
    promise: promise 
  });
});

// ============================================================================
// START SERVER
// ============================================================================

server = app.listen(PORT, () => {
  logStartup(PORT, NODE_ENV);
  
  if (NODE_ENV === 'development') {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${NODE_ENV}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api\n`);
  }
});

export default app;