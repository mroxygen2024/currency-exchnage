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

  return useMutation<FavoritePairOut, ApiError, FavoritePairCreate, { previous: FavoritePairOut[] | undefined }>({
    mutationFn: (data) => favoritesApi.addFavorite(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.all });

      const previous = queryClient.getQueryData<FavoritePairOut[]>(favoritesKeys.all);

      queryClient.setQueryData<FavoritePairOut[]>(favoritesKeys.all, (old) => {
        if (!old) return old;
        const optimistic: FavoritePairOut = {
          id: Date.now(),
          user_id: 0,
          base_currency: data.base_currency.toUpperCase(),
          target_currency: data.target_currency.toUpperCase(),
          created_at: new Date(),
        };
        return [...old, optimistic];
      });

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}

export function useDeleteFavorite() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, ApiError, number, { previous: FavoritePairOut[] | undefined }>({
    mutationFn: (id) => favoritesApi.deleteFavorite(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.all });

      const previous = queryClient.getQueryData<FavoritePairOut[]>(favoritesKeys.all);

      queryClient.setQueryData<FavoritePairOut[]>(favoritesKeys.all, (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== id);
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}
