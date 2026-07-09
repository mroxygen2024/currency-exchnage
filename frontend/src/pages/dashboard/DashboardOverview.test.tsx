import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardOverview } from './DashboardOverview';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as hooks from '../../hooks/useCurrency';

// Mock the TanStack query hooks
vi.mock('../../hooks/useCurrency', () => ({
  useSupportedCurrencies: vi.fn(() => ({
    data: ['USD', 'EUR', 'GBP'],
    isLoading: false,
    error: null,
  })),
  useCurrencySymbols: vi.fn(() => ({
    data: { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' },
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
  useConversionHistory: vi.fn(() => ({
    data: {
      items: [
        {
          id: 101,
          from_currency: 'USD',
          to_currency: 'EUR',
          amount: 1000,
          rate: 0.92,
          result: 920,
          converted_at: new Date('2026-07-09T09:12:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
    },
    isLoading: false,
    error: null,
  })),
}));

describe('DashboardOverview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default useCurrencyConversion implementation
    vi.mocked(hooks.useCurrencyConversion).mockImplementation(() => ({
      data: null,
      isLoading: false,
      error: null,
    } as any));

    // Default useCurrencyRate implementation
    vi.mocked(hooks.useCurrencyRate).mockImplementation(() => ({
      data: { rate: 0.92 },
      isLoading: false,
      error: null,
    } as any));

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
          <DashboardOverview />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders quick exchange tool and recent conversions logs table', () => {
    renderComponent();

    expect(screen.getByText('Quick Exchange Tool')).toBeInTheDocument();
    expect(screen.getByText('Recent Conversion Logs')).toBeInTheDocument();
    expect(screen.getByText('Transaction Amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /convert & save log/i })).toBeInTheDocument();
  });

  it('performs live rate preview calculation based on amount input', async () => {
    renderComponent();

    const amountInput = screen.getByLabelText('Transaction Amount');
    fireEvent.change(amountInput, { target: { value: '500' } });

    // Live estimation calculated rate should display
    await waitFor(() => {
      expect(screen.getByText('1 USD = 0.92000 EUR')).toBeInTheDocument();
    });
  });

  it('swaps currencies when clicking the swap button', async () => {
    renderComponent();

    const swapButton = screen.getByRole('button', { name: /swap currencies/i });

    // Swap currencies (USD -> EUR becomes EUR -> USD)
    fireEvent.click(swapButton);

    await waitFor(() => {
      const fromBtn = screen.getByRole('button', { name: /🇪🇺 eur/i });
      const toBtn = screen.getByRole('button', { name: /🇺🇸 usd/i });
      expect(fromBtn).toBeInTheDocument();
      expect(toBtn).toBeInTheDocument();
    });
  });

  it('validates amount input and displays error message for invalid input', async () => {
    renderComponent();

    const amountInput = screen.getByLabelText('Transaction Amount');
    fireEvent.change(amountInput, { target: { value: '-50' } });

    const submitButton = screen.getByRole('button', { name: /convert & save log/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
    });
  });

  it('triggers conversion hook and displays conversion result card on successful convert', async () => {
    // Return data only when query is enabled (i.e. queryParams are set on submit)
    vi.mocked(hooks.useCurrencyConversion).mockImplementation((params, enabled) => {
      console.log('MOCK CALL:', params, enabled);
      return {
        data: enabled ? {
          id: 1234,
          from_currency: 'USD',
          to_currency: 'EUR',
          amount: 1000,
          rate: 0.92,
          result: 920,
          converted_at: new Date('2026-07-09T10:30:00.000Z'),
        } : null,
        isLoading: false,
        error: null,
      } as any;
    });

    renderComponent();

    const submitButton = screen.getByRole('button', { name: /convert & save log/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Conversion Successful')).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent === 'ID: #1234')).toBeInTheDocument();
      expect(screen.getAllByText((_, el) => el?.textContent === '1,000 USD').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText((_, el) => el?.textContent?.includes('920.00 EUR') ?? false).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders recent conversions list from history query', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1,000 USD')).toBeInTheDocument();
      expect(screen.getByText('920 EUR')).toBeInTheDocument();
      expect(screen.getByText('0.92000')).toBeInTheDocument();
    });
  });
});
