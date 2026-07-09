import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';

// Mock useAuth hook
vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Protected and Guest Routes', () => {
  describe('ProtectedRoute', () => {
    it('should show loading spinner when session is restoring', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div data-testid="protected-content">Secret Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Restoring secure access')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should redirect to /auth/login if user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div data-testid="protected-content">Secret Dashboard</div>} />
            </Route>
            <Route path="/auth/login" element={<div data-testid="login-page">Sign In Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render content if user is authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 1, email: 'test@example.com', role: 'user', is_active: true, is_deleted: false },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div data-testid="protected-content">Secret Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(screen.queryByText('Restoring secure access')).not.toBeInTheDocument();
    });
  });

  describe('GuestRoute', () => {
    it('should redirect authenticated users to dashboard (/dashboard)', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 1, email: 'test@example.com', role: 'user', is_active: true, is_deleted: false },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/auth/login" element={<div data-testid="login-page">Sign In Page</div>} />
            </Route>
            <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should render guest route page if user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/auth/login" element={<div data-testid="login-page">Sign In Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });
});
