import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardFavorites } from './DashboardFavorites';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FavoritePairOut } from '../../api/types';

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

vi.mock('../../hooks/useRealtimeRates', () => ({
  useRealtimeRates: vi.fn(() => ({
    rates: { USDEUR: 0.9215, EURGBP: 0.8621 },
    status: 'connected',
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    clearSubscriptions: vi.fn(),
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
    data: [
      { id: 1, base_currency: 'USD', target_currency: 'EUR', rate: 0.92, last_updated: new Date() },
      { id: 2, base_currency: 'EUR', target_currency: 'GBP', rate: 0.86, last_updated: new Date() },
    ],
    isLoading: false,
    error: null,
  })),
}));

const defaultFavorites: FavoritePairOut[] = [
  { id: 1, user_id: 1, base_currency: 'USD', target_currency: 'EUR', created_at: new Date() },
  { id: 2, user_id: 1, base_currency: 'EUR', target_currency: 'GBP', created_at: new Date() },
];

let currentFavorites: FavoritePairOut[] = [...defaultFavorites];
let favoritesError: { message: string } | null = null;
let favoritesLoading = false;

const mockMutate = vi.fn();
const mockRefetchFavs = vi.fn();

vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({
    data: currentFavorites,
    isLoading: favoritesLoading,
    error: favoritesError,
    refetch: mockRefetchFavs,
  }),
  useAddFavorite: () => ({
    mutate: mockMutate,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  }),
  useDeleteFavorite: () => ({
    mutate: mockMutate,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  }),
}));

describe('DashboardFavorites', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    currentFavorites = [...defaultFavorites];
    favoritesError = null;
    favoritesLoading = false;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardFavorites />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders the page title and description', () => {
    renderComponent();

    expect(screen.getByText('Favorite Currency Pairs')).toBeInTheDocument();
    expect(screen.getByText(/Track your monitored pairs/)).toBeInTheDocument();
  });

  it('renders the add favorite form with currency selectors', () => {
    renderComponent();

    expect(screen.getByText('Add Favorite Pair')).toBeInTheDocument();
    expect(screen.getByText('Base Currency')).toBeInTheDocument();
    expect(screen.getByText('Quote Currency')).toBeInTheDocument();
    expect(screen.getByTestId('add-favorite-form')).toBeInTheDocument();
  });

  it('renders the add favorite submit button', () => {
    renderComponent();

    expect(screen.getByTestId('add-favorite-submit')).toBeInTheDocument();
    expect(screen.getByTestId('add-favorite-submit')).toHaveTextContent('Add to Watchlist');
  });

  it('renders the favorites grid with favorite cards', () => {
    renderComponent();

    expect(screen.getByTestId('favorites-grid')).toBeInTheDocument();
    expect(screen.getByTestId('fav-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('fav-card-2')).toBeInTheDocument();
  });

  it('displays the correct currency pair names on cards', () => {
    renderComponent();

    expect(screen.getByText('USD/EUR')).toBeInTheDocument();
    expect(screen.getByText('EUR/GBP')).toBeInTheDocument();
  });

  it('displays the monitoring count', () => {
    renderComponent();

    expect(screen.getByText('Monitoring 2 pairs')).toBeInTheDocument();
  });

  it('displays the live connection status', () => {
    renderComponent();

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays live rates from websocket', () => {
    renderComponent();

    expect(screen.getByText('0.9215')).toBeInTheDocument();
  });

  it('displays bid and ask spread values', () => {
    renderComponent();

    const spreadValues = screen.getAllByText(/\d\.\d{4}/);
    expect(spreadValues.length).toBeGreaterThan(0);
  });

  it('shows Live badge on cards with websocket rates', () => {
    renderComponent();

    const liveBadges = screen.getAllByText('Live');
    expect(liveBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('has a remove button for each favorite', () => {
    renderComponent();

    const removeButtons = screen.getAllByLabelText(/Remove .* from favorites/);
    expect(removeButtons.length).toBe(2);
  });

  it('calls deleteFavorite.mutate when remove is clicked', () => {
    renderComponent();

    const removeButtons = screen.getAllByLabelText(/Remove .* from favorites/);
    fireEvent.click(removeButtons[0]);

    expect(mockMutate).toHaveBeenCalled();
    const firstCall = mockMutate.mock.calls[0];
    expect(firstCall[0]).toBe(1);
  });

  it('has a swap button to exchange currencies', () => {
    renderComponent();

    expect(screen.getByLabelText('Swap currencies')).toBeInTheDocument();
  });

  it('shows empty state when no favorites exist', () => {
    currentFavorites = [];
    renderComponent();

    expect(screen.getByTestId('empty-favorites')).toBeInTheDocument();
    expect(screen.getByText('No favorite pairs yet')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    favoritesLoading = true;
    currentFavorites = [];
    renderComponent();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state with retry button', () => {
    favoritesError = { message: 'Network error' };
    currentFavorites = [];
    renderComponent();

    expect(screen.getByText('Failed to load favorites')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByTestId('retry-favorites')).toBeInTheDocument();
  });

  it('calls refetch when retry is clicked', () => {
    favoritesError = { message: 'Timeout' };
    currentFavorites = [];
    renderComponent();

    fireEvent.click(screen.getByTestId('retry-favorites'));
    expect(mockRefetchFavs).toHaveBeenCalled();
  });
});
