import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../api/endpoints/auth';
import { tokenStorage } from '../api/storage';
import type { UserOut } from '../api/types';

// Mock authApi endpoints
vi.mock('../api/endpoints/auth', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

// Test helper component to consume AuthContext
function TestComponent() {
  const { user, isAuthenticated, isLoading, error, login, register, logout } = useAuth();

  if (isLoading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'guest'}</div>
      {user && <div data-testid="user-email">{user.email}</div>}
      {error && <div data-testid="auth-error">{error}</div>}
      <button
        data-testid="btn-login"
        onClick={() => login({ email: 'test@example.com', password: 'password123' })}
      >
        Login
      </button>
      <button
        data-testid="btn-register"
        onClick={() =>
          register({
            email: 'reg@example.com',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe',
          })
        }
      >
        Register
      </button>
      <button data-testid="btn-logout" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  const mockUser: UserOut = {
    id: 1,
    email: 'test@example.com',
    is_active: true,
    first_name: 'John',
    last_name: 'Doe',
    role: 'user',
    is_deleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize and resolve to guest state if no tokens are stored', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    });
  });

  it('should automatically restore session if access and refresh tokens exist', async () => {
    tokenStorage.setTokens('access-token-123', 'refresh-token-123');
    vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
  });

  it('should clear tokens and enter guest state if restoring session fails', async () => {
    tokenStorage.setTokens('access-token-123', 'refresh-token-123');
    vi.mocked(authApi.getMe).mockRejectedValueOnce(new Error('Session validation failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('should successfully log in, set tokens and fetch profile info', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
    });
    vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('btn-login').click();
    });

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('should register and then automatically trigger login flow', async () => {
    const regUser: UserOut = { ...mockUser, email: 'reg@example.com' };
    vi.mocked(authApi.register).mockResolvedValueOnce(regUser);
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
    });
    vi.mocked(authApi.getMe).mockResolvedValueOnce(regUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('btn-register').click();
    });

    expect(authApi.register).toHaveBeenCalledWith({
      email: 'reg@example.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe',
    });
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'reg@example.com',
      password: 'password123',
    });
    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('reg@example.com');
  });

  it('should log out, invoke logout API and clear session tokens', async () => {
    tokenStorage.setTokens('access-token-123', 'refresh-token-123');
    vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');

    await act(async () => {
      screen.getByTestId('btn-logout').click();
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
