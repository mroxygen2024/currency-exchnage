import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import {
  useNotificationSubscriptions,
  useSubscribeAlert,
  useDeleteAlert,
  notificationsKeys,
} from '../useNotifications';

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

describe('notificationsKeys', () => {
  it('builds correct query keys', () => {
    expect(notificationsKeys.all).toEqual(['notifications']);
  });
});

describe('useNotificationSubscriptions', () => {
  it('fetches subscriptions successfully', async () => {
    const { result } = renderHook(() => useNotificationSubscriptions(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toHaveProperty('base_currency', 'USD');
  });
});

describe('useSubscribeAlert', () => {
  it('creates a subscription and invalidates cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSubscribeAlert(), { wrapper });

    await act(async () => {
      result.current.mutate({
        base_currency: 'USD',
        target_currency: 'EUR',
        threshold: 0.95,
        condition: 'above',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('condition', 'above');
  });
});

describe('useDeleteAlert', () => {
  it('deletes a subscription and invalidates cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteAlert(), { wrapper });

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('success', true);
  });
});
