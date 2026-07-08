import { AxiosError } from 'axios';

/**
 * Standardized validation error structure from FastAPI (Pydantic validation errors)
 */
export interface ApiValidationError {
  field: string;
  message: string;
  type: string;
}

/**
 * Custom API Error class that formats and standardizes server and network errors.
 */
export class ApiError extends Error {
  public readonly status: number | null;
  public readonly code: string | null;
  public readonly validationErrors: ApiValidationError[] | null;
  public readonly raw: unknown;

  constructor(message: string, status: number | null = null, code: string | null = null, validationErrors: ApiValidationError[] | null = null, raw: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.validationErrors = validationErrors;
    this.raw = raw;
    
    // Set the prototype explicitly to preserve instance checks in compiled JS
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Helper to check if this error represents a validation error.
   */
  get isValidationError(): boolean {
    return !!this.validationErrors && this.validationErrors.length > 0;
  }

  /**
   * Helper to get validation errors mapped by field name.
   */
  get validationErrorsMap(): Record<string, string> {
    if (!this.validationErrors) return {};
    return this.validationErrors.reduce((acc, err) => {
      acc[err.field] = err.message;
      return acc;
    }, {} as Record<string, string>);
  }
}

/**
 * Parses any thrown error into a standardized ApiError.
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status ?? null;
    const responseData = axiosError.response?.data;
    
    let message = 'An unexpected network error occurred.';
    let validationErrors: ApiValidationError[] | null = null;
    let code: string | null = null;

    if (axiosError.code === 'ECONNABORTED') {
      message = 'Request timed out. Please check your connection and try again.';
      code = 'TIMEOUT';
    } else if (axiosError.code === 'ERR_NETWORK') {
      message = 'Network error. Please verify you are connected to the internet and the server is running.';
      code = 'NETWORK_ERROR';
    }

    if (responseData) {
      // 1. Check for FastAPI Pydantic detail validation errors
      if (Array.isArray(responseData.detail)) {
        message = 'Validation failed. Please correct the highlighted fields.';
        code = 'VALIDATION_ERROR';
        validationErrors = responseData.detail.map((err: any) => {
          // loc can be ["body", "password"] or ["query", "base"]
          // We extract the field name from the last element of the location array
          const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : 'unknown';
          return {
            field: String(field),
            message: err.msg || 'Invalid value',
            type: err.type || 'value_error',
          };
        });
      }
      // 2. Check for simple string detail message
      else if (typeof responseData.detail === 'string') {
        message = responseData.detail;
      }
      // 3. Check for specific message property
      else if (typeof responseData.message === 'string') {
        message = responseData.message;
      }
      // 4. Default error extraction from status
      else if (status) {
        message = `Request failed with status code ${status}`;
      }
    }

    return new ApiError(message, status, code || axiosError.code || null, validationErrors, error);
  }

  // Handle regular native Javascript Errors
  if (error instanceof Error) {
    return new ApiError(error.message, null, null, null, error);
  }

  // Handle anything else
  return new ApiError(String(error), null, null, null, error);
}
