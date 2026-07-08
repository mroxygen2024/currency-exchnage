import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '../api/errors';
import { authApi } from '../api/endpoints/auth';
import { tokenStorage } from '../api/storage';
import type { LoginRequest, RegisterRequest, UserOut } from '../api/types';

type AuthContextValue = {
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<UserOut>;
  register: (data: RegisterRequest) => Promise<UserOut>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserOut | null>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const sessionExpiredEventName = 'auth:session-expired';

function getAuthErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to complete the authentication request.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    tokenStorage.clearTokens();
    setUser(null);
  };

  const refreshSession = async () => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();

    if (!accessToken || !refreshToken) {
      clearSession();
      setIsLoading(false);
      return null;
    }

    try {
      const profile = await authApi.getMe();
      setUser(profile);
      setError(null);
      return profile;
    } catch (errorValue) {
      clearSession();
      setError(getAuthErrorMessage(errorValue));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();

    const handleSessionExpired = () => {
      clearSession();
      setError('Your session expired. Please sign in again.');
      setIsLoading(false);
    };

    window.addEventListener(sessionExpiredEventName, handleSessionExpired);

    return () => {
      window.removeEventListener(sessionExpiredEventName, handleSessionExpired);
    };
  }, []);

  const login = async (data: LoginRequest) => {
    setError(null);
    await authApi.login(data);
    const profile = await authApi.getMe();
    setUser(profile);
    setIsLoading(false);
    return profile;
  };

  const register = async (data: RegisterRequest) => {
    setError(null);
    await authApi.register(data);
    return login({ email: data.email, password: data.password });
  };

  const logout = async () => {
    setError(null);

    try {
      await authApi.logout();
    } finally {
      clearSession();
      setIsLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      login,
      register,
      logout,
      refreshSession,
      clearError: () => setError(null),
    }),
    [error, isLoading, login, logout, refreshSession, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}