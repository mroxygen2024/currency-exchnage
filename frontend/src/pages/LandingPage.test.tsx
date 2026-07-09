import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../auth/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

function renderLandingPage(authenticated = false) {
  mockUseAuth.mockReturnValue({
    user: authenticated ? { id: 1, email: 'test@example.com', is_active: true, first_name: 'Jane', last_name: 'Doe', role: 'user', is_deleted: false } : null,
    isAuthenticated: authenticated,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn(),
    clearError: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders hero section with heading', () => {
    renderLandingPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/institutional-grade/i);
  });

  it('renders navigation links', () => {
    renderLandingPage();
    expect(screen.getByRole('link', { name: /aeroexchange home/i })).toBeInTheDocument();
  });

  it('renders converter widget', () => {
    renderLandingPage();
    expect(screen.getByLabelText(/send amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/source currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/receive amount/i)).toBeInTheDocument();
  });

  it('shows sign in and get started for guests', () => {
    renderLandingPage(false);
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(signInLinks[0]).toHaveAttribute('href', '/auth/login');

    const getStartedLinks = screen.getAllByRole('link', { name: /get started/i });
    expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/auth/register');
  });

  it('shows dashboard and logout for authenticated users', () => {
    renderLandingPage(true);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('swap button swaps currencies', async () => {
    renderLandingPage();
    const swapButton = screen.getByRole('button', { name: /swap currencies/i });
    const fromSelect = screen.getByLabelText(/source currency/i);
    const toSelect = screen.getByLabelText(/target currency/i);

    const initialFrom = fromSelect.value;
    const initialTo = toSelect.value;

    fireEvent.click(swapButton);

    await waitFor(() => {
      expect(fromSelect.value).toBe(initialTo);
      expect(toSelect.value).toBe(initialFrom);
    });
  });

  it('displays conversion rate after conversion', async () => {
    renderLandingPage();
    await waitFor(() => {
      expect(screen.getByText(/rate:/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders rates table section', () => {
    renderLandingPage();
    expect(screen.getByText(/top currency pairs/i)).toBeInTheDocument();
  });

  it('renders FAQ section', () => {
    renderLandingPage();
    expect(screen.getByText(/frequently asked questions/i)).toBeInTheDocument();
  });

  it('FAQ accordion expands and collapses', async () => {
    renderLandingPage();
    const faqButton = screen.getByRole('button', { name: /how secure is the bearer token/i });
    fireEvent.click(faqButton);

    await waitFor(() => {
      expect(screen.getByText(/extremely secure/i)).toBeInTheDocument();
    });

    fireEvent.click(faqButton);

    await waitFor(() => {
      expect(screen.queryByText(/extremely secure/i)).not.toBeInTheDocument();
    });
  });

  it('convert now button scrolls to calculator', async () => {
    renderLandingPage();
    const convertNowBtn = screen.getByRole('button', { name: /convert now/i });
    fireEvent.click(convertNowBtn);

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('renders feature section', () => {
    renderLandingPage();
    expect(screen.getByText(/architected for speed/i)).toBeInTheDocument();
    expect(screen.getByText(/bearer token authentication flow/i)).toBeInTheDocument();
  });

  it('renders footer', () => {
    renderLandingPage();
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
  });
});
