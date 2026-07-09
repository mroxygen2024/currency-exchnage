import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '../api/endpoints/favorites';
import { FavoritePairCreate, FavoritePairOut } from '../api/types';
import { ApiError } from '../api/errors';

export const favoritesKeys = {
  all: ['favorites'] as const,
};

export function useFavorites() {
  return useQuery<FavoritePairOut[], ApiError>({
    queryKey: favoritesKeys.all,
    queryFn: () => favoritesApi.getFavorites(),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();

  return useMutation<FavoritePairOut, ApiError, FavoritePairCreate>({
    mutationFn: (data) => favoritesApi.addFavorite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}

export function useDeleteFavorite() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, ApiError, number>({
    mutationFn: (id) => favoritesApi.deleteFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}
