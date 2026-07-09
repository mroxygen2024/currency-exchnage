const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const parseTimeoutEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * API Environment Configuration
 */
export const API_CONFIG = {
  BASE_URL: normalizeBaseUrl(import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_BASE_URL),
  TIMEOUT: parseTimeoutEnv(import.meta.env.VITE_API_TIMEOUT, DEFAULT_TIMEOUT_MS),
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'currency_tracker_access_token',
    REFRESH_TOKEN: 'currency_tracker_refresh_token',
  },
  VALIDATE_RESPONSES: parseBooleanEnv(import.meta.env.VITE_VALIDATE_API_RESPONSES, import.meta.env.MODE !== 'production'),
  LOG_VALIDATION_ERRORS: parseBooleanEnv(import.meta.env.VITE_LOG_API_VALIDATION_ERRORS, true),
} as const;
