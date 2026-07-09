import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus by default for a smoother UX
      refetchOnWindowFocus: false,
      // Retry once by default for query failures
      retry: 1,
    },
  },
});
