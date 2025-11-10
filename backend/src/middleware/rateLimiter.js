// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================
// Simple in-memory rate limiting to prevent abuse
// For production with multiple instances, consider Redis-backed rate limiting

import logger from '../config/logger.config.js';

// Store for tracking requests: { ip: { count, resetTime } }
const requestStore = new Map();

// Configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 900; // requests per window

// Stricter limits for auth endpoints
const AUTH_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const AUTH_MAX_REQUESTS = 5; // login attempts per window

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestStore.entries()) {
    if (data.resetTime < now) {
      requestStore.delete(ip);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * General rate limiting middleware
 */
export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  let requestData = requestStore.get(ip);
  
  // Initialize or reset if window expired
  if (!requestData || requestData.resetTime < now) {
    requestData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
    requestStore.set(ip, requestData);
  }
  
  requestData.count++;
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - requestData.count));
  res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
  
  // Check if limit exceeded
  if (requestData.count > MAX_REQUESTS) {
    logger.warn('Rate limit exceeded', {
      ip,
      path: req.path,
      count: requestData.count,
    });
    
    return res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
    });
  }
  
  next();
}

/**
 * Stricter rate limiting for authentication endpoints
 */
export function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const storeKey = `auth:${ip}`;
  
  let requestData = requestStore.get(storeKey);
  
  // Initialize or reset if window expired
  if (!requestData || requestData.resetTime < now) {
    requestData = {
      count: 0,
      resetTime: now + AUTH_RATE_LIMIT_WINDOW,
    };
    requestStore.set(storeKey, requestData);
  }
  
  requestData.count++;
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', AUTH_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, AUTH_MAX_REQUESTS - requestData.count));
  res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
  
  // Check if limit exceeded
  if (requestData.count > AUTH_MAX_REQUESTS) {
    logger.warn('Auth rate limit exceeded', {
      ip,
      path: req.path,
      count: requestData.count,
    });
    
    return res.status(429).json({
      error: 'Too many login attempts',
      message: 'You have exceeded the maximum number of login attempts. Please try again later.',
      retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
    });
  }
  
  next();
}

export default {
  rateLimiter,
  authRateLimiter,
};