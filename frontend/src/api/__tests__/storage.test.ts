import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from '../storage';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getAccessToken returns null when no token', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('setAccessToken and getAccessToken work together', () => {
    tokenStorage.setAccessToken('access-123');
    expect(tokenStorage.getAccessToken()).toBe('access-123');
  });

  it('getRefreshToken returns null when no token', () => {
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('setRefreshToken and getRefreshToken work together', () => {
    tokenStorage.setRefreshToken('refresh-456');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-456');
  });

  it('setTokens sets both tokens', () => {
    tokenStorage.setTokens('access-789', 'refresh-012');
    expect(tokenStorage.getAccessToken()).toBe('access-789');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-012');
  });

  it('clearTokens removes both tokens', () => {
    tokenStorage.setTokens('access-789', 'refresh-012');
    tokenStorage.clearTokens();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('setAccessToken overwrites existing token', () => {
    tokenStorage.setAccessToken('old-token');
    tokenStorage.setAccessToken('new-token');
    expect(tokenStorage.getAccessToken()).toBe('new-token');
  });

  it('uses correct localStorage keys', () => {
    tokenStorage.setAccessToken('test');
    expect(localStorage.getItem('currency_tracker_access_token')).toBe('test');

    tokenStorage.setRefreshToken('test');
    expect(localStorage.getItem('currency_tracker_refresh_token')).toBe('test');
  });
});
