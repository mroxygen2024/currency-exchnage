import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { API_CONFIG } from './config';
import { tokenStorage } from './storage';
import { tokenSchema } from './schemas/auth';
import { ApiError, parseApiError } from './errors';
import { dispatchSessionExpiredEvent } from './helpers';

// Extend AxiosRequestConfig to include custom options
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    _retry?: boolean;
  }
}

/**
 * Creates the base Axios instance configured with environment settings.
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach bearer tokens automatically if available
const setAuthorizationHeader = (
  headers: InternalAxiosRequestConfig['headers'],
  token: string
): void => {
  if (typeof headers?.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
    return;
  }

  if (headers) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
};

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.skipAuth) {
      return config;
    }

    const token = tokenStorage.getAccessToken();
    if (token) {
      setAuthorizationHeader(config.headers, token);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Variables for managing the token refresh queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

/**
 * Processes the queue of pending requests that failed due to 401.
 */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const isAuthMutationRequest = (requestUrl?: string): boolean => {
  if (!requestUrl) {
    return false;
  }

  return ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) => requestUrl.includes(path));
};

const resolveRequestConfig = (error: AxiosError) => error.config as InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
};

const clearAuthorizationHeader = (): void => {
  delete axiosInstance.defaults.headers.common.Authorization;
};

// Response Interceptor: Intercept errors and handle Token Refresh flow
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = resolveRequestConfig(error);

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Check if error is 401 and the request was not a retry and was not one of the auth mutation endpoints
    const isUnauthorized = error.response?.status === 401;
    const isAuthMutationEndpoint = isAuthMutationRequest(originalRequest.url);

    if (isUnauthorized && !originalRequest._retry && !isAuthMutationEndpoint) {
      if (isRefreshing) {
        // Queue the request until refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers = originalRequest.headers ?? {};
              setAuthorizationHeader(originalRequest.headers, token);
              resolve(axiosInstance(originalRequest));
            },
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();

      if (!refreshToken) {
        isRefreshing = false;
        tokenStorage.clearTokens();
        clearAuthorizationHeader();
        // Emit global event to notify the application of session expiration
        dispatchSessionExpiredEvent();
        return Promise.reject(error);
      }

      try {
        // Request token rotation
        const response = await axiosInstance.post(
          '/auth/refresh',
          { refresh_token: refreshToken },
          { skipAuth: true }
        );

        const { access_token, refresh_token: newRefreshToken } = tokenSchema.parse(response.data);
        
        tokenStorage.setTokens(access_token, newRefreshToken);
        originalRequest.headers = originalRequest.headers ?? {};
        setAuthorizationHeader(originalRequest.headers, access_token);
        
        processQueue(null, access_token);
        isRefreshing = false;
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        tokenStorage.clearTokens();
        clearAuthorizationHeader();
        dispatchSessionExpiredEvent();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Generic type-safe request wrapper.
 * Performs the request using Axios and optionally validates the response with Zod.
 * 
 * @param config Axios request configuration
 * @param schema Optional Zod schema for response parsing and validation
 */
export async function apiRequest<T>(
  config: AxiosRequestConfig,
  schema?: z.ZodSchema<T>
): Promise<T> {
  try {
    const response = await axiosInstance(config);
    const data = response.data;

    // Validate the response data if a Zod schema is provided
    if (schema && config.responseType !== 'blob' && config.responseType !== 'arraybuffer') {
      if (API_CONFIG.VALIDATE_RESPONSES) {
        try {
          return schema.parse(data);
        } catch (zodError) {
          if (API_CONFIG.LOG_VALIDATION_ERRORS) {
            console.error('API Response validation failed:', {
              url: config.url,
              method: config.method,
              errors: zodError instanceof z.ZodError ? zodError.issues : zodError,
              data,
            });
          }
          // In development/test mode, we strictly reject if validation fails.
          // This keeps types 100% accurate.
          throw new ApiError(
            'API response schema validation failed. The payload structure does not match expectations.',
            response.status,
            'RESPONSE_VALIDATION_FAILURE',
            null,
            zodError
          );
        }
      }
      // If validation is disabled (e.g. production fallback), cast the data
      return data as T;
    }

    return data as T;
  } catch (error) {
    throw parseApiError(error);
  }
}

export default axiosInstance;
