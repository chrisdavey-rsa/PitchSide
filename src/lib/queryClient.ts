import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // Refetch when the tab/app returns to the foreground (PWA + desktop).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
