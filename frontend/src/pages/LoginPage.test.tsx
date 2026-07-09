import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/errors';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../auth/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

function renderLoginPage(route = '/auth/login') {
  window.history.pushState({}, '', route);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
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
  });

  it('renders form fields with labels', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders sign in button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders link to register page', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: /create one here/i })).toHaveAttribute('href', '/auth/register');
  });

  it('shows validation error for empty email on submit', async () => {
    renderLoginPage();
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    renderLoginPage();
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls login on valid form submission', async () => {
    const loginMock = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: loginMock,
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderLoginPage();
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('displays error message on login failure', async () => {
    const loginMock = vi.fn().mockRejectedValue(
      new ApiError('Invalid credentials', 401, 'AUTH_ERROR')
    );
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: loginMock,
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderLoginPage();
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('displays auth context error', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: 'Session expired',
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderLoginPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Session expired');
  });

  it('shows loading state during submission', async () => {
    let resolveLogin: (value: unknown) => void;
    const loginMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: loginMock,
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderLoginPage();
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    resolveLogin!(undefined);
  });

  it('has accessible error attributes', async () => {
    renderLoginPage();
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    });
  });
});
