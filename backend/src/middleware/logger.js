// ============================================================================
// REQUEST LOGGING MIDDLEWARE
// ============================================================================
// Logs all HTTP requests with timing, status codes, and errors
// Provides structured logging for debugging and monitoring

import logger from '../config/logger.config.js';

/**
 * Express middleware for logging HTTP requests
 * Captures: method, path, status, duration, errors
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override res.end to log after response is sent
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Build log metadata
    const logMeta = {
      method: req.method,
      path: req.path,
      status: statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
    };
    
    // Add user ID if authenticated
    if (req.user && req.user.id) {
      logMeta.userId = req.user.id;
    }
    
    // Add query params if present (except sensitive data)
    if (req.query && Object.keys(req.query).length > 0) {
      logMeta.query = req.query;
    }
    
    // Log based on status code
    const message = `${req.method} ${req.path} - ${statusCode}`;
    
    if (statusCode >= 500) {
      logger.error(message, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(message, logMeta);
    } else {
      logger.http(message, logMeta);
    }
    
    // Call the original end function
    originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * Error logging middleware
 * Should be placed after all routes
 */
export function errorLogger(err, req, res, next) {
  const logMeta = {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    ip: req.ip || req.connection.remoteAddress,
  };
  
  if (req.user && req.user.id) {
    logMeta.userId = req.user.id;
  }
  
  logger.error(`Unhandled error: ${err.message}`, logMeta);
  
  // Pass to next error handler
  next(err);
}

/**
 * Log application startup
 */
export function logStartup(port, environment) {
  logger.info('🚀 Server started successfully', {
    port,
    environment,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
  });
}

/**
 * Log application shutdown
 */
export function logShutdown(signal) {
  logger.info('🛑 Server shutting down', {
    signal,
    uptime: process.uptime(),
  });
}

export default {
  requestLogger,
  errorLogger,
  logStartup,
  logShutdown,
};