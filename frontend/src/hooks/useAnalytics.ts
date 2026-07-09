import { useQuery } from '@tanstack/react-query';
import { analyticsApi, TrendFilterParams } from '../api/endpoints/analytics';
import { CurrencyAnalyticsOut, CurrencyTrendsOut } from '../api/types';
import { ApiError } from '../api/errors';

export const analyticsKeys = {
  all: ['analytics'] as const,
  trends: (params: TrendFilterParams) => [...analyticsKeys.all, 'trends', params] as const,
};

export function useSystemAnalytics() {
  return useQuery<CurrencyAnalyticsOut, ApiError>({
    queryKey: analyticsKeys.all,
    queryFn: () => analyticsApi.getSystemAnalytics(),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useTrends(params: TrendFilterParams) {
  return useQuery<CurrencyTrendsOut, ApiError>({
    queryKey: analyticsKeys.trends(params),
    queryFn: () => analyticsApi.getTrends(params),
    enabled: !!params.base && !!params.target,
    staleTime: 60_000,
    retry: 1,
  });
}
