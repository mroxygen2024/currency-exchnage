import { API_CONFIG } from './config';

/**
 * Token Storage Utility
 * Manages JWT tokens inside localStorage with type-safety.
 */
export const tokenStorage = {
  /**
   * Retrieves the current access token.
   */
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  },

  /**
   * Saves the access token.
   */
  setAccessToken(token: string): void {
    try {
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (e) {
      console.error('Failed to save access token to storage', e);
    }
  },

  /**
   * Retrieves the current refresh token.
   */
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  /**
   * Saves the refresh token.
   */
  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, token);
    } catch (e) {
      console.error('Failed to save refresh token to storage', e);
    }
  },

  /**
   * Saves both access and refresh tokens.
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  },

  /**
   * Clears all tokens from storage.
   */
  clearTokens(): void {
    try {
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    } catch (e) {
      console.error('Failed to clear tokens from storage', e);
    }
  },
};
