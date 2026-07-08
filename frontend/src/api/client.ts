import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { API_CONFIG } from './config';
import { tokenStorage } from './storage';
import { ApiError, parseApiError } from './errors';

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
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Skip attaching Authorization header if explicitly requested (e.g. login/register)
    if (config.skipAuth) {
      return config;
    }

    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
  reject: (err: any) => void;
}> = [];

/**
 * Processes the queue of pending requests that failed due to 401.
 */
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Intercept errors and handle Token Refresh flow
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and the request was not a retry and was not an auth endpoint
    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    
    if (isUnauthorized && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue the request until refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(axiosInstance(originalRequest));
            },
            reject: (err: any) => {
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
        // Emit global event to notify the application of session expiration
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(error);
      }

      try {
        // Request token rotation
        const response = await axios.post(
          `${API_CONFIG.BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { skipAuth: true }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;
        
        tokenStorage.setTokens(access_token, newRefreshToken);
        
        // Update authorization header
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        
        processQueue(null, access_token);
        isRefreshing = false;
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        tokenStorage.clearTokens();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
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
    if (schema) {
      if (API_CONFIG.VALIDATE_RESPONSES) {
        try {
          return schema.parse(data);
        } catch (zodError) {
          if (API_CONFIG.LOG_VALIDATION_ERRORS) {
            console.error('API Response validation failed:', {
              url: config.url,
              method: config.method,
              errors: zodError instanceof z.ZodError ? zodError.errors : zodError,
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
