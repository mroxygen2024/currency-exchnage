import { apiRequest } from '../client';
import { tokenStorage } from '../storage';
import {
  userOutSchema,
  tokenSchema,
} from '../schemas/auth';
import {
  UserOut,
  Token,
  LoginRequest,
  RegisterRequest,
} from '../types';

/**
 * Authentication Endpoints API helper
 */
export const authApi = {
  /**
   * Register a new user account.
   */
  async register(data: RegisterRequest): Promise<UserOut> {
    return apiRequest<UserOut>(
      {
        url: '/auth/register',
        method: 'POST',
        data: {
          email: data.email,
          password: data.password,
          first_name: data.first_name,
          last_name: data.last_name,
        },
        skipAuth: true,
      },
      userOutSchema
    );
  },

  /**
   * Log in a user and receive JWT tokens.
   * Note: The backend expects form-urlencoded data matching the OAuth2 spec (username/password).
   */
  async login(data: LoginRequest): Promise<Token> {
    const params = new URLSearchParams();
    params.append('username', data.email);
    params.append('password', data.password);

    const tokens = await apiRequest<Token>(
      {
        url: '/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: params.toString(),
        skipAuth: true,
      },
      tokenSchema
    );

    // Save tokens automatically on successful login
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  /**
   * Explicitly refresh the user's session tokens.
   */
  async refresh(refreshToken: string): Promise<Token> {
    const tokens = await apiRequest<Token>(
      {
        url: '/auth/refresh',
        method: 'POST',
        data: { refresh_token: refreshToken },
        skipAuth: true,
      },
      tokenSchema
    );

    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  /**
   * Log out the current user session and revoke the refresh token.
   */
  async logout(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await apiRequest({
          url: '/auth/logout',
          method: 'POST',
          data: { refresh_token: refreshToken },
          skipAuth: true,
        });
      } finally {
        // Always clear tokens locally even if the server revocation fails (e.g. token already expired)
        tokenStorage.clearTokens();
      }
    } else {
      tokenStorage.clearTokens();
    }
  },

  /**
   * Retrieve the profile details of the currently logged-in user.
   */
  async getMe(): Promise<UserOut> {
    return apiRequest<UserOut>(
      {
        url: '/auth/me',
        method: 'GET',
      },
      userOutSchema
    );
  },
};
