import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { DashboardLayout } from './DashboardLayout';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../auth/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

function createWrapper(route = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  window.history.pushState({}, '', route);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        is_active: true,
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'user',
        is_deleted: false,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders sidebar navigation links', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /conversions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /favorites/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders logo link', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByRole('link', { name: /aeroexchange home/i })).toHaveAttribute('href', '/');
  });

  it('renders user email in sidebar footer', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders user first name', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('renders notifications bell button', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /system notifications/i })).toBeInTheDocument();
  });

  it('renders profile menu button', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /user profile settings menu/i })).toBeInTheDocument();
  });

  it('opens mobile sidebar on toggle click', () => {
    render(<DashboardLayout />, { wrapper: createWrapper() });
    const toggle = screen.getByRole('button', { name: /open sidebar menu/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /close sidebar menu/i })).toBeInTheDocument();
  });

  it('renders breadcrumbs', () => {
    render(<DashboardLayout />, { wrapper: createWrapper('/dashboard/history') });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
