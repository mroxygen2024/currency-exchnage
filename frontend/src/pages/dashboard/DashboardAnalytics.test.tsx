import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardAnalytics } from './DashboardAnalytics';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('../../hooks/useCurrency', () => ({
  useSupportedCurrencies: vi.fn(() => ({
    data: ['USD', 'EUR', 'GBP', 'JPY'],
    isLoading: false,
    error: null,
  })),
  useCurrencySymbols: vi.fn(() => ({
    data: { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen' },
    isLoading: false,
    error: null,
  })),
  useCurrencyRate: vi.fn(() => ({
    data: { rate: 0.92 },
    isLoading: false,
    error: null,
  })),
  useCurrencyConversion: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useAllRates: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

const mockTrends = vi.fn();
const mockSystemAnalytics = vi.fn();

vi.mock('../../hooks/useAnalytics', () => ({
  useSystemAnalytics: (...args: unknown[]) => mockSystemAnalytics(...args),
  useTrends: (...args: unknown[]) => mockTrends(...args),
}));

describe('DashboardAnalytics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSystemAnalytics.mockReturnValue({
      data: {
        total_conversions: 1250,
        popular_pairs: [
          { from_currency: 'USD', to_currency: 'EUR', count: 320, total_amount: 150000 },
          { from_currency: 'EUR', to_currency: 'GBP', count: 210, total_amount: 98000 },
          { from_currency: 'GBP', to_currency: 'USD', count: 180, total_amount: 75000 },
        ],
        total_volume_by_currency: {
          USD: 250000,
          EUR: 180000,
          GBP: 120000,
          JPY: 50000,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockTrends.mockReturnValue({
      data: {
        base_currency: 'USD',
        target_currency: 'EUR',
        trends: [
          { rate: 0.918, timestamp: '2026-06-01T00:00:00Z' },
          { rate: 0.922, timestamp: '2026-06-02T00:00:00Z' },
          { rate: 0.925, timestamp: '2026-06-03T00:00:00Z' },
          { rate: 0.920, timestamp: '2026-06-04T00:00:00Z' },
        ],
        total: 4,
        page: 1,
        limit: 100,
        pages: 1,
        stats: {
          average_rate: 0.92125,
          percentage_change: 0.22,
          min_rate: 0.918,
          max_rate: 0.925,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardAnalytics />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders the page title and description', () => {
    renderComponent();

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText(/Track exchange rate trends/)).toBeInTheDocument();
  });

  it('renders the currency pair selectors', () => {
    renderComponent();

    expect(screen.getByText('Currency Pair')).toBeInTheDocument();
    expect(screen.getByLabelText('Swap currencies')).toBeInTheDocument();
  });

  it('renders the date range filter with presets', () => {
    renderComponent();

    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('7D')).toBeInTheDocument();
    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('90D')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
  });

  it('renders the 30D preset as active by default', () => {
    renderComponent();

    const preset30d = screen.getByText('30D');
    expect(preset30d.className).toContain('analytics-filters__preset--active');
  });

  it('renders statistics cards with correct values', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Average Rate')).toBeInTheDocument();
      expect(screen.getByText('Highest Rate')).toBeInTheDocument();
      expect(screen.getByText('Lowest Rate')).toBeInTheDocument();
      expect(screen.getByText('Period Change')).toBeInTheDocument();
    });
  });

  it('renders the average rate value', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0.92125')).toBeInTheDocument();
    });
  });

  it('renders the period change with positive styling', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('+0.22%')).toBeInTheDocument();
    });
  });

  it('renders the trend chart section', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Rate Trend: USD \/ EUR/)).toBeInTheDocument();
    });
  });

  it('renders the popular pairs table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Most Popular Pairs')).toBeInTheDocument();
      expect(screen.getByText('USD / EUR')).toBeInTheDocument();
      expect(screen.getByText('EUR / GBP')).toBeInTheDocument();
      expect(screen.getByText('GBP / USD')).toBeInTheDocument();
    });
  });

  it('renders the volume by currency chart section', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Volume by Currency')).toBeInTheDocument();
    });
  });

  it('renders the summary bar with total conversions', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Total Conversions')).toBeInTheDocument();
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });
  });

  it('displays conversion counts in the popular pairs table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('320')).toBeInTheDocument();
      expect(screen.getByText('210')).toBeInTheDocument();
      expect(screen.getByText('180')).toBeInTheDocument();
    });
  });

  it('displays volume amounts in the popular pairs table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('$150,000')).toBeInTheDocument();
      expect(screen.getByText('$98,000')).toBeInTheDocument();
      expect(screen.getByText('$75,000')).toBeInTheDocument();
    });
  });

  it('shows loading state for trends', () => {
    mockTrends.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderComponent();

    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows error state for trends', () => {
    mockTrends.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch trends' },
      refetch: vi.fn(),
      isFetching: false,
    });

    renderComponent();

    expect(screen.getByText('Failed to load trend statistics')).toBeInTheDocument();
    const errorMessages = screen.getAllByText('Failed to fetch trends');
    expect(errorMessages.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: /retry/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state for system analytics', () => {
    mockSystemAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Server error' },
      refetch: vi.fn(),
    });

    renderComponent();

    const errorMessages = screen.getAllByText('Failed to load');
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('calls refetch when retry button is clicked on trend error', () => {
    const refetchTrends = vi.fn();
    mockTrends.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network error' },
      refetch: refetchTrends,
      isFetching: false,
    });

    renderComponent();

    const retryButtons = screen.getAllByRole('button', { name: /retry/i });
    fireEvent.click(retryButtons[0]);

    expect(refetchTrends).toHaveBeenCalledTimes(1);
  });

  it('switches active preset when clicking a different time range', () => {
    renderComponent();

    const sevenDays = screen.getByText('7D');
    fireEvent.click(sevenDays);

    expect(sevenDays.className).toContain('analytics-filters__preset--active');
    const thirtyDays = screen.getByText('30D');
    expect(thirtyDays.className).not.toContain('analytics-filters__preset--active');
  });

  it('swaps currencies when clicking the swap button', () => {
    renderComponent();

    const swapButton = screen.getByLabelText('Swap currencies');
    fireEvent.click(swapButton);

    expect(mockTrends).toHaveBeenCalled();
  });

  it('shows empty state when no trend data is available', () => {
    mockTrends.mockReturnValue({
      data: {
        base_currency: 'USD',
        target_currency: 'EUR',
        trends: [],
        total: 0,
        page: 1,
        limit: 100,
        pages: 0,
        stats: { average_rate: 0, percentage_change: 0, min_rate: 0, max_rate: 0 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderComponent();

    expect(screen.getByText(/No trend data available/)).toBeInTheDocument();
  });

  it('renders date inputs', () => {
    renderComponent();

    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');
    expect(startInput).toBeInTheDocument();
    expect(endInput).toBeInTheDocument();
    expect(startInput.getAttribute('type')).toBe('date');
    expect(endInput.getAttribute('type')).toBe('date');
  });

  it('shows reset button when custom dates are used', () => {
    renderComponent();

    const startInput = screen.getByLabelText('Start date');
    fireEvent.change(startInput, { target: { value: '2026-01-01' } });

    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('hides presets when reset is clicked', () => {
    renderComponent();

    const startInput = screen.getByLabelText('Start date');
    fireEvent.change(startInput, { target: { value: '2026-01-01' } });

    const resetBtn = screen.getByText('Reset');
    fireEvent.click(resetBtn);

    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });
});
