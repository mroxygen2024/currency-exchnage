import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import {
  useSystemAnalytics,
  useTrends,
  analyticsKeys,
} from '../useAnalytics';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('analyticsKeys', () => {
  it('builds correct query keys', () => {
    expect(analyticsKeys.all).toEqual(['analytics']);
    expect(analyticsKeys.trends({ base: 'USD', target: 'EUR' })).toEqual([
      'analytics', 'trends', { base: 'USD', target: 'EUR' },
    ]);
  });
});

describe('useSystemAnalytics', () => {
  it('fetches analytics successfully', async () => {
    const { result } = renderHook(() => useSystemAnalytics(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('total_conversions', 42);
    expect(result.current.data!.popular_pairs).toHaveLength(2);
  });
});

describe('useTrends', () => {
  it('fetches trends for valid pair', async () => {
    const { result } = renderHook(
      () => useTrends({ base: 'USD', target: 'EUR' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('base_currency', 'USD');
    expect(result.current.data!.trends).toHaveLength(2);
    expect(result.current.data!.stats).toHaveProperty('average_rate', 0.915);
  });

  it('is disabled when base is empty', async () => {
    const { result } = renderHook(
      () => useTrends({ base: '', target: 'EUR' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('is disabled when target is empty', async () => {
    const { result } = renderHook(
      () => useTrends({ base: 'USD', target: '' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });
});
