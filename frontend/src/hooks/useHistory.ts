import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { historyApi, HistoryFilterParams } from '../api/endpoints/history';
import { PaginatedHistory, CurrencyConversionOut } from '../api/types';
import { ApiError } from '../api/errors';

export const historyKeys = {
  all: ['history'] as const,
  list: (params?: HistoryFilterParams) => [...historyKeys.all, 'list', params] as const,
  detail: (id: number) => [...historyKeys.all, 'detail', id] as const,
};

export function useHistoryList(params?: HistoryFilterParams) {
  return useQuery<PaginatedHistory, ApiError>({
    queryKey: historyKeys.list(params),
    queryFn: () => historyApi.getHistory(params),
    staleTime: 15 * 1000,
    retry: 1,
  });
}

export function useHistoryRecord(id: number, enabled = true) {
  return useQuery<CurrencyConversionOut, ApiError>({
    queryKey: historyKeys.detail(id),
    queryFn: () => historyApi.getRecord(id),
    enabled,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useDeleteHistoryRecord() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (id: number) => historyApi.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}
