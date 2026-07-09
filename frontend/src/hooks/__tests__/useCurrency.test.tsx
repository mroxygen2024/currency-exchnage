import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import {
  useSupportedCurrencies,
  useCurrencySymbols,
  useAllRates,
  useCurrencyRate,
  useCurrencyConversion,
  currencyKeys,
} from '../useCurrency';

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

describe('currencyKeys', () => {
  it('builds correct query keys', () => {
    expect(currencyKeys.all).toEqual(['currency']);
    expect(currencyKeys.supported()).toEqual(['currency', 'supported']);
    expect(currencyKeys.symbols()).toEqual(['currency', 'symbols']);
    expect(currencyKeys.rates()).toEqual(['currency', 'rates']);
    expect(currencyKeys.rate('USD', 'EUR')).toEqual(['currency', 'rates', 'USD', 'EUR']);
    expect(currencyKeys.convert('USD', 'EUR', 100)).toEqual(['currency', 'convert', 'USD', 'EUR', 100]);
  });
});

describe('useSupportedCurrencies', () => {
  it('fetches supported currencies successfully', async () => {
    const { result } = renderHook(() => useSupportedCurrencies(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']);
  });
});

describe('useCurrencySymbols', () => {
  it('fetches currency symbols successfully', async () => {
    const { result } = renderHook(() => useCurrencySymbols(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('USD', 'United States Dollar');
    expect(result.current.data).toHaveProperty('EUR', 'Euro');
  });
});

describe('useAllRates', () => {
  it('fetches all rates successfully', async () => {
    const { result } = renderHook(() => useAllRates(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toHaveProperty('base_currency', 'USD');
  });
});

describe('useCurrencyRate', () => {
  it('fetches rate for a valid pair', async () => {
    const { result } = renderHook(() => useCurrencyRate('USD', 'EUR'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('rate', 0.92);
  });

  it('is disabled for invalid pair (short codes)', async () => {
    const { result } = renderHook(() => useCurrencyRate('US', 'EUR'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('is disabled when base is missing', async () => {
    const { result } = renderHook(() => useCurrencyRate(undefined, 'EUR'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useCurrencyConversion', () => {
  it('performs conversion with valid params', async () => {
    const { result } = renderHook(
      () => useCurrencyConversion({ from: 'USD', to: 'EUR', amount: 1000 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveProperty('result', 920);
    expect(result.current.data).toHaveProperty('rate', 0.92);
  });

  it('is disabled when enabled is false', async () => {
    const { result } = renderHook(
      () => useCurrencyConversion({ from: 'USD', to: 'EUR', amount: 1000 }, false),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('is disabled for invalid params (zero amount)', async () => {
    const { result } = renderHook(
      () => useCurrencyConversion({ from: 'USD', to: 'EUR', amount: 0 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });
});
