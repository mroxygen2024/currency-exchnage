import { describe, it, expect } from 'vitest';
import { ApiError, parseApiError } from '../errors';
import axios from 'axios';

describe('ApiError', () => {
  it('creates error with all properties', () => {
    const error = new ApiError(
      'Test error',
      400,
      'TEST_CODE',
      [{ field: 'email', message: 'Invalid', type: 'value_error' }],
      new Error('raw')
    );

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('TEST_CODE');
    expect(error.validationErrors).toHaveLength(1);
    expect(error.raw).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });

  it('creates error with defaults', () => {
    const error = new ApiError('Simple error');
    expect(error.status).toBeNull();
    expect(error.code).toBeNull();
    expect(error.validationErrors).toBeNull();
    expect(error.raw).toBeNull();
  });

  it('isValidationError returns true when has validation errors', () => {
    const error = new ApiError('Error', 400, null, [
      { field: 'email', message: 'Invalid', type: 'value_error' },
    ]);
    expect(error.isValidationError).toBe(true);
  });

  it('isValidationError returns false when no validation errors', () => {
    const error = new ApiError('Error');
    expect(error.isValidationError).toBe(false);
  });

  it('validationErrorsMap groups errors by field', () => {
    const error = new ApiError('Error', 400, null, [
      { field: 'email', message: 'Invalid email', type: 'value_error' },
      { field: 'password', message: 'Too short', type: 'value_error' },
    ]);
    const map = error.validationErrorsMap;
    expect(map.email).toBe('Invalid email');
    expect(map.password).toBe('Too short');
  });

  it('validationErrorsMap returns empty when no errors', () => {
    const error = new ApiError('Error');
    expect(error.validationErrorsMap).toEqual({});
  });
});

describe('parseApiError', () => {
  it('passes through ApiError', () => {
    const original = new ApiError('Original', 500);
    const parsed = parseApiError(original);
    expect(parsed).toBe(original);
  });

  it('parses Axios error with detail string', async () => {
    const axiosError = {
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      config: {},
      request: {},
      response: {
        status: 400,
        data: { detail: 'Bad request' },
      },
      message: 'Request failed with status code 400',
      name: 'AxiosError',
      status: 400,
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const parsed = parseApiError(axiosError);
    expect(parsed.message).toBe('Bad request');
    expect(parsed.status).toBe(400);

    vi.restoreAllMocks();
  });

  it('parses Axios validation error array', () => {
    const axiosError = {
      isAxiosError: true,
      code: 'ERR_BAD_RESPONSE',
      config: {},
      request: {},
      response: {
        status: 422,
        data: {
          detail: [
            { loc: ['body', 'email'], msg: 'Invalid email', type: 'value_error' },
          ],
        },
      },
      message: 'Request failed with status code 422',
      name: 'AxiosError',
      status: 422,
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const parsed = parseApiError(axiosError);
    expect(parsed.isValidationError).toBe(true);
    expect(parsed.validationErrors).toHaveLength(1);
    expect(parsed.validationErrors![0].field).toBe('email');

    vi.restoreAllMocks();
  });

  it('parses network error', () => {
    const axiosError = {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      config: {},
      request: {},
      response: undefined,
      message: 'Network Error',
      name: 'AxiosError',
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const parsed = parseApiError(axiosError);
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.message).toContain('Network error');

    vi.restoreAllMocks();
  });

  it('parses timeout error', () => {
    const axiosError = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      config: {},
      request: {},
      response: undefined,
      message: 'timeout of 10000ms exceeded',
      name: 'AxiosError',
    };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const parsed = parseApiError(axiosError);
    expect(parsed.code).toBe('TIMEOUT');
    expect(parsed.message).toContain('timed out');

    vi.restoreAllMocks();
  });

  it('parses generic Error', () => {
    const parsed = parseApiError(new Error('Generic failure'));
    expect(parsed.message).toBe('Generic failure');
    expect(parsed.status).toBeNull();
  });

  it('parses unknown value', () => {
    const parsed = parseApiError('string error');
    expect(parsed.message).toBe('string error');
  });
});
