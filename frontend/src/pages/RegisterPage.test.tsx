import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { ApiError } from '../api/errors';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../auth/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

function renderRegisterPage(route = '/auth/register') {
  window.history.pushState({}, '', route);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
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

  it('renders all form fields', () => {
    renderRegisterPage();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders create account button', () => {
    renderRegisterPage();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    renderRegisterPage();
    expect(screen.getByRole('link', { name: /sign in$/i })).toHaveAttribute('href', '/auth/login');
  });

  it('shows validation error for empty email on submit', async () => {
    renderRegisterPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    renderRegisterPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('calls register on valid form submission', async () => {
    const registerMock = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: registerMock,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Doe',
      });
    });
  });

  it('displays error message on registration failure', async () => {
    const registerMock = vi.fn().mockRejectedValue(
      new ApiError('Email already registered', 409, 'CONFLICT')
    );
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: registerMock,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'taken@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
    });
  });

  it('shows loading state during submission', async () => {
    let resolveRegister: (value: unknown) => void;
    const registerMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve; })
    );
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: registerMock,
      logout: vi.fn(),
      refreshSession: vi.fn(),
      clearError: vi.fn(),
    });

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    });

    resolveRegister!(undefined);
  });

  it('has accessible error attributes on fields', async () => {
    renderRegisterPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
