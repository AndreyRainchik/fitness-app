// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================
// Provides endpoints for monitoring application health and status
// Used by Render and other platforms for uptime monitoring

import express from 'express';
import { db } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/health
 * Basic health check - returns 200 if server is running
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check including database connectivity
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      server: 'ok',
      database: 'checking',
    },
  };

  try {
    // Test database connection
    const result = db.exec('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = 'error';
    health.errors = {
      database: error.message,
    };
  }

  // Return appropriate status code
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /api/health/ready
 * Readiness check - used by container orchestrators
 * Returns 200 when app is ready to serve traffic
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is accessible
    db.exec('SELECT 1');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /api/health/live
 * Liveness check - used by container orchestrators
 * Returns 200 if the process is alive (even if database is down)
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

export default router;