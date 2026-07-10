import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardHistory } from './DashboardHistory';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/Toast';
import * as historyHooks from '../../hooks/useHistory';

const mockHistoryItems = [
  {
    id: 1,
    from_currency: 'USD',
    to_currency: 'EUR',
    amount: 1000,
    rate: 0.92,
    result: 920,
    converted_at: '2026-07-09T09:12:00.000Z',
  },
  {
    id: 2,
    from_currency: 'GBP',
    to_currency: 'JPY',
    amount: 500,
    rate: 190.5,
    result: 95250,
    converted_at: '2026-07-08T14:30:00.000Z',
  },
  {
    id: 3,
    from_currency: 'EUR',
    to_currency: 'USD',
    amount: 2000,
    rate: 1.087,
    result: 2174,
    converted_at: '2026-07-07T11:00:00.000Z',
  },
];

const mockPaginatedData = {
  items: mockHistoryItems,
  total: 12,
  page: 1,
  limit: 6,
  pages: 2,
};

vi.mock('../../hooks/useHistory', () => ({
  useHistoryList: vi.fn(),
  useHistoryRecord: vi.fn(),
  useDeleteHistoryRecord: vi.fn(),
}));

vi.mock('../../api/endpoints/history', () => ({
  historyApi: {
    getHistory: vi.fn(),
    exportHistory: vi.fn(),
    getRecord: vi.fn(),
    deleteRecord: vi.fn(),
  },
}));

describe('DashboardHistory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.mocked(historyHooks.useHistoryList).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof historyHooks.useHistoryList>);

    vi.mocked(historyHooks.useDeleteHistoryRecord).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof historyHooks.useDeleteHistoryRecord>);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <DashboardHistory />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders the page title and export button', () => {
    renderComponent();

    expect(screen.getByText('Conversion History')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders the search input and date filter', () => {
    renderComponent();

    expect(screen.getByPlaceholderText(/search by currency code/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Date Range:')).toBeInTheDocument();
  });

  it('renders the table with column headers including sort buttons', () => {
    renderComponent();

    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date & time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /from \(amount\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /to \(received\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exchange rate/i })).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('displays history records in the table', () => {
    renderComponent();

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00 USD/)).toBeInTheDocument();
    expect(screen.getByText(/920\.00 EUR/)).toBeInTheDocument();
  });

  it('shows view and delete action buttons for each row', () => {
    renderComponent();

    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    const deleteButtons = screen.getAllByRole('button', { name: /delete log/i });

    expect(viewButtons.length).toBe(3);
    expect(deleteButtons.length).toBe(3);
  });

  it('shows pagination when total items exceed items per page', () => {
    renderComponent();

    expect(screen.getByText('Showing 1 to 3 of 12 entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('resets page to 1 when search term changes', async () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/search by currency code/i);
    fireEvent.change(searchInput, { target: { value: 'USD' } });

    await waitFor(() => {
      expect(historyHooks.useHistoryList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  it('shows loading skeleton while data is loading', async () => {
    vi.mocked(historyHooks.useHistoryList).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof historyHooks.useHistoryList>);

    renderComponent();

    const skeletons = document.querySelectorAll('.animate-pulse.rounded');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error message when data fetch fails', async () => {
    vi.mocked(historyHooks.useHistoryList).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof historyHooks.useHistoryList>);

    renderComponent();

    expect(screen.getByText(/failed to load conversion history/i)).toBeInTheDocument();
  });

  it('shows empty state when no records match filters', async () => {
    vi.mocked(historyHooks.useHistoryList).mockReturnValue({
      data: { items: [], total: 0, page: 1, limit: 6, pages: 0 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof historyHooks.useHistoryList>);

    renderComponent();

    expect(screen.getByText(/no conversion logs matching/i)).toBeInTheDocument();
  });

  it('displays all time options in the date filter dropdown', () => {
    renderComponent();

    const dateSelect = screen.getByLabelText('Date Range:');
    expect(dateSelect).toBeInTheDocument();

    const options = dateSelect.querySelectorAll('option');
    expect(options.length).toBe(4);
    expect(options[0].textContent).toBe('All Time');
    expect(options[1].textContent).toBe('Today');
    expect(options[2].textContent).toBe('Past Week');
    expect(options[3].textContent).toBe('Past Month');
  });
});
