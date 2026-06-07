import { QueryClient } from "@tanstack/react-query";

/**
 * Singleton QueryClient — exported so non-React code (e.g. auth store)
 * can call queryClient.clear() on logout to prevent stale data leaking
 * between user sessions.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60 * 1000,       // 1 min
      gcTime:               5 * 60 * 1000,   // 5 min
      retry:                1,
      refetchOnWindowFocus: false,
    },
  },
});
