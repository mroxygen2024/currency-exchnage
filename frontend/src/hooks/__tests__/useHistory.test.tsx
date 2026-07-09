import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useHistoryList, useHistoryRecord, useDeleteHistoryRecord, historyKeys } from '../useHistory';

const mockGetHistory = vi.fn();
const mockGetRecord = vi.fn();
const mockDeleteRecord = vi.fn();

vi.mock('../../api/endpoints/history', () => ({
  historyApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getRecord: (...args: unknown[]) => mockGetRecord(...args),
    deleteRecord: (...args: unknown[]) => mockDeleteRecord(...args),
    exportHistory: vi.fn(),
  },
}));

describe('useHistory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockGetHistory.mockReset();
    mockGetRecord.mockReset();
    mockDeleteRecord.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const createWrapper = () => {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };
  };

  describe('historyKeys', () => {
    it('returns correct key structure', () => {
      expect(historyKeys.all).toEqual(['history']);
      expect(historyKeys.list()).toEqual(['history', 'list', undefined]);
      expect(historyKeys.list({ page: 1, limit: 10 })).toEqual(['history', 'list', { page: 1, limit: 10 }]);
      expect(historyKeys.detail(42)).toEqual(['history', 'detail', 42]);
    });
  });

  describe('useHistoryList', () => {
    it('fetches history data successfully', async () => {
      const mockData = {
        items: [
          { id: 1, from_currency: 'USD', to_currency: 'EUR', amount: 100, rate: 0.92, result: 92, converted_at: '2026-07-09T09:00:00Z' },
        ],
        total: 1,
        page: 1,
        limit: 6,
        pages: 1,
      };

      mockGetHistory.mockResolvedValue(mockData);

      const { result } = renderHook(() => useHistoryList({ page: 1, limit: 6 }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockGetHistory).toHaveBeenCalledWith({ page: 1, limit: 6 });
    });

    it('calls the API with the correct params', async () => {
      mockGetHistory.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 6,
        pages: 0,
      });

      const params = {
        page: 2,
        limit: 10,
        from_currency: 'USD',
        sort_by: 'amount' as const,
        sort_order: 'desc' as const,
      };

      renderHook(() => useHistoryList(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(params);
      });
    });

    it('returns pending state initially', () => {
      mockGetHistory.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useHistoryList(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('pending');
      expect(result.current.fetchStatus).toBe('fetching');
    });

    it('calls the API when no params are provided', async () => {
      mockGetHistory.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 6,
        pages: 0,
      });

      renderHook(() => useHistoryList(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('useHistoryRecord', () => {
    it('fetches a single record successfully', async () => {
      const mockRecord = {
        id: 42,
        from_currency: 'USD',
        to_currency: 'EUR',
        amount: 100,
        rate: 0.92,
        result: 92,
        converted_at: '2026-07-09T09:00:00Z',
      };

      mockGetRecord.mockResolvedValue(mockRecord);

      const { result } = renderHook(() => useHistoryRecord(42), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRecord);
      expect(mockGetRecord).toHaveBeenCalledWith(42);
    });

    it('does not fetch when enabled is false', () => {
      const { result } = renderHook(() => useHistoryRecord(42, false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockGetRecord).not.toHaveBeenCalled();
    });
  });

  describe('useDeleteHistoryRecord', () => {
    it('calls deleteRecord and invalidates queries on success', async () => {
      mockDeleteRecord.mockResolvedValue(undefined);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteHistoryRecord(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(42);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDeleteRecord).toHaveBeenCalledWith(42);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: historyKeys.all });
    });

    it('provides mutate function', () => {
      const { result } = renderHook(() => useDeleteHistoryRecord(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.mutate).toBe('function');
      expect(typeof result.current.mutateAsync).toBe('function');
    });
  });
});
