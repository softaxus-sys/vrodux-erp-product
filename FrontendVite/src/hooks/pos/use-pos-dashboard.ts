import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { posDashboardApi, type PosOverviewDto } from "@/lib/pos/pos-dashboard.api";

export function usePosOverview(from: string, to: string) {
  return useQuery<PosOverviewDto>({
    queryKey: ["pos-dashboard", "overview", from, to],
    queryFn:  () => posDashboardApi.getOverview(from, to),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,        // takings move while the shop is open
    placeholderData: keepPreviousData, // switching range keeps the last figures on screen
  });
}
