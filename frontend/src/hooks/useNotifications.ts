import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/endpoints/notifications';
import { NotificationSubscriptionCreate, NotificationSubscriptionOut } from '../api/types';
import { ApiError } from '../api/errors';

export const notificationsKeys = {
  all: ['notifications'] as const,
};

export function useNotificationSubscriptions() {
  return useQuery<NotificationSubscriptionOut[], ApiError>({
    queryKey: notificationsKeys.all,
    queryFn: () => notificationsApi.getSubscriptions(),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSubscribeAlert() {
  const queryClient = useQueryClient();

  return useMutation<NotificationSubscriptionOut, ApiError, NotificationSubscriptionCreate>({
    mutationFn: (data) => notificationsApi.subscribe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, ApiError, number>({
    mutationFn: (id) => notificationsApi.deleteSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
