import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currencyApi } from '../api/endpoints/currency';
import { historyApi, HistoryFilterParams } from '../api/endpoints/history';
import { CurrencyRateOut, CurrencyConversionOut, PaginatedHistory } from '../api/types';
import { ApiError } from '../api/errors';

export const currencyKeys = {
  all: ['currency'] as const,
  supported: () => [...currencyKeys.all, 'supported'] as const,
  symbols: () => [...currencyKeys.all, 'symbols'] as const,
  rates: () => [...currencyKeys.all, 'rates'] as const,
  rate: (base: string, target: string) => [...currencyKeys.rates(), base.toUpperCase(), target.toUpperCase()] as const,
  convert: (from: string, to: string, amount: number) => [...currencyKeys.all, 'convert', from.toUpperCase(), to.toUpperCase(), amount] as const,
  history: (params?: HistoryFilterParams) => ['history', params] as const,
};

/**
 * Hook to retrieve the list of supported 3-letter currency codes.
 * Caches the response indefinitely as currency support is highly static.
 */
export function useSupportedCurrencies() {
  return useQuery<string[], ApiError>({
    queryKey: currencyKeys.supported(),
    queryFn: () => currencyApi.getSupported(),
    staleTime: Infinity, // Supported currencies don't change frequently
    gcTime: 24 * 60 * 60 * 1000, // Keep in garbage collection cache for 24 hours
    retry: 2,
  });
}

/**
 * Hook to retrieve the map of currency codes to full names (e.g. { USD: "United States Dollar" }).
 * Caches the response indefinitely as names are static.
 */
export function useCurrencySymbols() {
  return useQuery<Record<string, string>, ApiError>({
    queryKey: currencyKeys.symbols(),
    queryFn: () => currencyApi.getSymbols(),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to retrieve all currency exchange rates currently available.
 * Caches rates with a shorter staleTime since exchange rates are dynamic.
 */
export function useAllRates() {
  return useQuery<CurrencyRateOut[], ApiError>({
    queryKey: currencyKeys.rates(),
    queryFn: () => currencyApi.getAllRates(),
    staleTime: 30 * 1000, // 30 seconds stale time
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Hook to retrieve the exchange rate for a specific base/target currency pair.
 * Only runs if both base and target are valid.
 */
export function useCurrencyRate(base?: string, target?: string) {
  const cleanBase = base?.trim().toUpperCase();
  const cleanTarget = target?.trim().toUpperCase();
  const isValidPair = !!cleanBase && !!cleanTarget && cleanBase.length === 3 && cleanTarget.length === 3;

  return useQuery<CurrencyRateOut, ApiError>({
    queryKey: currencyKeys.rate(cleanBase || '', cleanTarget || ''),
    queryFn: () => currencyApi.getRate(cleanBase!, cleanTarget!),
    enabled: isValidPair,
    staleTime: 30 * 1000, // 30 seconds stale time
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Hook to perform currency conversion using GET /currencies/convert.
 * Only queries if enabled is true, and parameters are valid.
 */
export function useCurrencyConversion(
  params: { from: string; to: string; amount: number },
  enabled = true
) {
  const cleanFrom = params.from?.trim().toUpperCase();
  const cleanTo = params.to?.trim().toUpperCase();
  const isValid = !!cleanFrom && !!cleanTo && cleanFrom.length === 3 && cleanTo.length === 3 && params.amount > 0;

  return useQuery<CurrencyConversionOut, ApiError>({
    queryKey: currencyKeys.convert(cleanFrom || '', cleanTo || '', params.amount),
    queryFn: () => currencyApi.convert({ from: cleanFrom!, to: cleanTo!, amount: params.amount }),
    enabled: enabled && isValid,
    staleTime: 10 * 1000, // 10 seconds cache validity
    retry: 1,
  });
}

/**
 * Hook to retrieve user currency conversion history.
 */
export function useConversionHistory(params?: HistoryFilterParams) {
  return useQuery<PaginatedHistory, ApiError>({
    queryKey: currencyKeys.history(params),
    queryFn: () => historyApi.getHistory(params),
    staleTime: 15 * 1000,
    retry: 1,
  });
}

/**
 * Hook to delete a conversion history record.
 */
export function useDeleteHistoryRecord() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (id: number) => historyApi.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

