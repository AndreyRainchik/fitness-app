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
const LOGIN_MAX_FAILURES = 10; // failed sign-ins per IP per window
const REGISTER_MAX_REQUESTS = 5; // sign-ups per IP per window

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

/** The bucket for key, started fresh once its window has passed. */
function bucket(key, windowMs) {
  const now = Date.now();
  let data = requestStore.get(key);
  if (!data || data.resetTime < now) {
    data = { count: 0, resetTime: now + windowMs };
    requestStore.set(key, data);
  }
  return data;
}

function tooMany(req, res, data, error, message) {
  logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path, count: data.count });
  const retryAfter = Math.ceil((data.resetTime - Date.now()) / 1000);
  res.setHeader('Retry-After', retryAfter);
  return res.status(429).json({ error, message, retryAfter });
}

/**
 * Sign-in: only failed attempts count, so people who sign in successfully
 * (or on several devices) are never locked out. Keyed by client IP; behind a
 * proxy the server must set 'trust proxy' for req.ip to be the client's.
 */
export function loginRateLimiter(req, res, next) {
  const data = bucket(`login:${req.ip}`, AUTH_RATE_LIMIT_WINDOW);
  if (data.count >= LOGIN_MAX_FAILURES) {
    return tooMany(req, res, data, 'Too many failed sign-in attempts. Please try again in a few minutes.',
      'You have exceeded the maximum number of failed sign-in attempts. Please try again later.');
  }
  res.on('finish', () => {
    if (res.statusCode === 401) bucket(`login:${req.ip}`, AUTH_RATE_LIMIT_WINDOW).count++;
  });
  next();
}

/** Sign-up: every attempt counts, in a bucket of its own. */
export function registerRateLimiter(req, res, next) {
  const data = bucket(`register:${req.ip}`, AUTH_RATE_LIMIT_WINDOW);
  data.count++;
  if (data.count > REGISTER_MAX_REQUESTS) {
    return tooMany(req, res, data, 'Too many sign-up attempts. Please try again in a few minutes.',
      'You have exceeded the maximum number of sign-up attempts. Please try again later.');
  }
  next();
}

export default {
  rateLimiter,
  loginRateLimiter,
  registerRateLimiter,
};
