import { describe, it, expect, vi } from 'vitest';
import {
  toIsoString,
  normalizeQueryParams,
  formatDateQueryParams,
  createSessionExpiredEvent,
  dispatchSessionExpiredEvent,
} from '../helpers';

describe('toIsoString', () => {
  it('converts Date to ISO string', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(toIsoString(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('returns string as-is', () => {
    expect(toIsoString('2024-01-15')).toBe('2024-01-15');
  });

  it('returns undefined for null', () => {
    expect(toIsoString(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(toIsoString(undefined)).toBeUndefined();
  });
});

describe('normalizeQueryParams', () => {
  it('returns empty object for undefined', () => {
    expect(normalizeQueryParams(undefined)).toEqual({});
  });

  it('filters out null and undefined values', () => {
    const result = normalizeQueryParams({
      name: 'test',
      empty: null,
      missing: undefined,
      count: 5,
    });
    expect(result).toEqual({ name: 'test', count: 5 });
  });

  it('converts Date values to ISO strings', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    const result = normalizeQueryParams({ date });
    expect(result.date).toBe('2024-01-15T10:30:00.000Z');
  });

  it('expands arrays into entries', () => {
    const result = normalizeQueryParams({ tags: ['a', 'b', 'c'] });
    expect(result).toHaveProperty('tags');
  });

  it('filters null items from arrays', () => {
    const result = normalizeQueryParams({ tags: ['a', null, 'b'] });
    expect(result).toHaveProperty('tags');
  });

  it('converts Dates inside arrays', () => {
    const d1 = new Date('2024-01-15');
    const d2 = new Date('2024-01-16');
    const result = normalizeQueryParams({ dates: [d1, d2] });
    expect(result).toHaveProperty('dates');
  });
});

describe('formatDateQueryParams', () => {
  it('converts start_date and end_date', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    const result = formatDateQueryParams({ start_date: start, end_date: end });
    expect(result?.start_date).toBe('2024-01-01T00:00:00.000Z');
    expect(result?.end_date).toBe('2024-01-31T00:00:00.000Z');
  });

  it('returns undefined for undefined input', () => {
    expect(formatDateQueryParams(undefined)).toBeUndefined();
  });

  it('passes through non-date fields', () => {
    const result = formatDateQueryParams({ name: 'test', start_date: new Date('2024-01-01') });
    expect(result?.name).toBe('test');
  });
});

describe('createSessionExpiredEvent', () => {
  it('creates CustomEvent with correct name', () => {
    const event = createSessionExpiredEvent();
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe('auth:session-expired');
  });
});

describe('dispatchSessionExpiredEvent', () => {
  it('dispatches event on window', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    dispatchSessionExpiredEvent();
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth:session-expired' })
    );
    dispatchSpy.mockRestore();
  });
});
