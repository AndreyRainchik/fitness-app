// ============================================================================
// LOGGER CONFIGURATION
// ============================================================================
// Centralized logging configuration for development and production
// Supports multiple log levels and external logging services

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const LOG_COLORS = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m',  // Yellow
  info: '\x1b[36m',  // Cyan
  http: '\x1b[35m',  // Magenta
  debug: '\x1b[37m', // White
  reset: '\x1b[0m',
};

/**
 * Get current log level based on environment
 */
function getLogLevel() {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    return process.env.LOG_LEVEL || 'info';
  }
  
  return 'debug';
}

/**
 * Format timestamp for logs
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with color (for console only)
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const color = LOG_COLORS[level] || LOG_COLORS.reset;
  const reset = LOG_COLORS.reset;
  
  let formatted = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
  
  if (Object.keys(meta).length > 0) {
    formatted += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return formatted;
}

/**
 * Check if message should be logged based on current level
 */
function shouldLog(messageLevel) {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[messageLevel] <= LOG_LEVELS[currentLevel];
}

/**
 * Main logger class
 */
class Logger {
  constructor() {
    this.externalLogger = null;
    this.initializeExternalLogger();
  }

  /**
   * Initialize external logging service if configured
   * Supports: Better Stack (Logtail), Sentry, or custom endpoints
   */
  initializeExternalLogger() {
    const externalLogUrl = process.env.EXTERNAL_LOG_URL;
    const externalLogToken = process.env.EXTERNAL_LOG_TOKEN;
    
    if (externalLogUrl && externalLogToken) {
      this.externalLogger = {
        url: externalLogUrl,
        token: externalLogToken,
      };
      console.log('✅ External logging initialized');
    }
  }

  /**
   * Send log to external service
   */
  async sendToExternalLogger(level, message, meta = {}) {
    if (!this.externalLogger) return;

    try {
      const payload = {
        timestamp: new Date().toISOString(),
        level,
        message,
        meta,
        environment: process.env.NODE_ENV || 'development',
        service: 'fitness-app-backend',
      };

      // Use dynamic import for node-fetch (ESM)
      const fetch = (await import('node-fetch')).default;
      
      await fetch(this.externalLogger.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.externalLogger.token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Don't throw - external logging should never break the app
      console.error('Failed to send log to external service:', error.message);
    }
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
      this.sendToExternalLogger('error', message, meta);
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
      this.sendToExternalLogger('warn', message, meta);
    }
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
      this.sendToExternalLogger('info', message, meta);
    }
  }

  /**
   * Log HTTP request
   */
  http(message, meta = {}) {
    if (shouldLog('http')) {
      console.log(formatMessage('http', message, meta));
      // Don't send all HTTP logs to external service unless needed
      if (meta.status >= 400) {
        this.sendToExternalLogger('http', message, meta);
      }
    }
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
      // Don't send debug logs to external service
    }
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;