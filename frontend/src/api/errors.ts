import axios, { AxiosError } from 'axios';

/**
 * Standardized validation error structure from FastAPI (Pydantic validation errors)
 */
export interface ApiValidationError {
  field: string;
  message: string;
  type: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractFastApiValidationErrors = (detail: unknown): ApiValidationError[] | null => {
  if (!Array.isArray(detail)) {
    return null;
  }

  return detail
    .map((error) => {
      if (!isRecord(error)) {
        return null;
      }

      const location = Array.isArray(error.loc) ? error.loc : [];
      const field = location.length > 0 ? location[location.length - 1] : 'unknown';

      return {
        field: String(field),
        message: typeof error.msg === 'string' ? error.msg : 'Invalid value',
        type: typeof error.type === 'string' ? error.type : 'value_error',
      };
    })
    .filter((error): error is ApiValidationError => error !== null);
};

const resolveAxiosErrorMessage = (error: AxiosError, status: number | null, responseData: unknown): {
  message: string;
  code: string | null;
  validationErrors: ApiValidationError[] | null;
} => {
  let message = 'An unexpected network error occurred.';
  let code: string | null = null;
  const validationErrors: ApiValidationError[] | null = null;

  if (error.code === 'ECONNABORTED') {
    message = 'Request timed out. Please check your connection and try again.';
    code = 'TIMEOUT';
  } else if (error.code === 'ERR_NETWORK') {
    message = 'Network error. Please verify you are connected to the internet and the server is running.';
    code = 'NETWORK_ERROR';
  } else if (error.code === 'ERR_CANCELED') {
    message = 'Request was canceled.';
    code = 'CANCELED';
  }

  if (isRecord(responseData)) {
    const validationDetail = extractFastApiValidationErrors(responseData.detail);

    if (validationDetail) {
      return {
        message: 'Validation failed. Please correct the highlighted fields.',
        code: 'VALIDATION_ERROR',
        validationErrors: validationDetail,
      };
    }

    if (typeof responseData.detail === 'string') {
      return {
        message: responseData.detail,
        code,
        validationErrors,
      };
    }

    if (typeof responseData.message === 'string') {
      return {
        message: responseData.message,
        code,
        validationErrors,
      };
    }

    if (typeof responseData.error === 'string') {
      return {
        message: responseData.error,
        code,
        validationErrors,
      };
    }
  }

  if (status) {
    message = `Request failed with status code ${status}`;
  }

  return {
    message,
    code: code || error.code || null,
    validationErrors,
  };
};

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

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>;
    const status = axiosError.response?.status ?? null;
    const responseData = axiosError.response?.data;

    const resolved = resolveAxiosErrorMessage(axiosError, status, responseData);
    return new ApiError(resolved.message, status, resolved.code, resolved.validationErrors, error);
  }

  // Handle regular native Javascript Errors
  if (error instanceof Error) {
    return new ApiError(error.message, null, null, null, error);
  }

  // Handle anything else
  return new ApiError(String(error), null, null, null, error);
}
