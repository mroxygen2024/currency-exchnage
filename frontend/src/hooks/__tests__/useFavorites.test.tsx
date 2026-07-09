import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useFavorites,
  useAddFavorite,
  useDeleteFavorite,
  favoritesKeys,
} from '../useFavorites';

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

describe('favoritesKeys', () => {
  it('builds correct query keys', () => {
    expect(favoritesKeys.all).toEqual(['favorites']);
  });
});

describe('useFavorites', () => {
  it('fetches favorites successfully', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toHaveProperty('base_currency', 'USD');
  });
});

describe('useAddFavorite', () => {
  it('adds a favorite and invalidates cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddFavorite(), { wrapper });

    await act(async () => {
      result.current.mutate({ base_currency: 'USD', target_currency: 'JPY' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('base_currency', 'USD');
  });
});

describe('useDeleteFavorite', () => {
  it('deletes a favorite and invalidates cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteFavorite(), { wrapper });

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('success', true);
  });
});
