/**
 * API Environment Configuration
 */
export const API_CONFIG = {
  // Use VITE_API_URL environment variable if defined, otherwise fallback to local development URL
  BASE_URL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api/v1',
  
  // Timeout for API requests in milliseconds (10 seconds)
  TIMEOUT: Number(import.meta.env.VITE_API_TIMEOUT) || 10000,
  
  // Storage keys for authentication tokens
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'currency_tracker_access_token',
    REFRESH_TOKEN: 'currency_tracker_refresh_token',
  },
  
  // Settings for Zod schema validation
  VALIDATE_RESPONSES: import.meta.env.MODE !== 'production', // Enable strict parsing in dev/test, can be bypassed if needed
  LOG_VALIDATION_ERRORS: true, // Log Zod validation errors to console
};
