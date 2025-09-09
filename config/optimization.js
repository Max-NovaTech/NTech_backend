/**
 * Database and application optimization configuration
 * This file contains settings to reduce RAM usage and improve performance
 */

const optimizationConfig = {
  // Database connection pool settings
  database: {
    connectionLimit: 10, // Reduce connection pool size
    acquireTimeout: 30000,
    timeout: 20000,
    reconnect: true,
    reconnectTries: 3,
    reconnectInterval: 1000
  },

  // Query optimization settings
  queries: {
    defaultLimit: 100, // Default pagination limit
    maxLimit: 1000, // Maximum allowed limit
    cacheTimeout: 300000, // 5 minutes cache timeout
    batchSize: 500 // Batch processing size
  },

  // Memory management settings
  memory: {
    gcInterval: 300000, // Force GC every 5 minutes
    memoryThreshold: 512, // MB - trigger cleanup above this
    cacheCleanupInterval: 300000, // Clean cache every 5 minutes
    maxCacheSize: 1000 // Maximum cache entries
  },

  // API rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // Max requests per window
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Response optimization
  response: {
    compression: true,
    removeCircularRefs: true,
    selectiveFields: true,
    streamLargeResponses: true
  }
};

module.exports = optimizationConfig;
