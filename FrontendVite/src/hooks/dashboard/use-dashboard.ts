import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/dashboard/dashboard.api";

const QK = "dashboard";

export function useKpiCards() {
  return useQuery({
    queryKey: [QK, "kpis"],
    queryFn:  dashboardApi.getKpiCards,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRevenueChart() {
  return useQuery({
    queryKey: [QK, "revenue-chart"],
    queryFn:  dashboardApi.getRevenueChart,
    staleTime: 5 * 60 * 1000,
  });
}

export function useModuleUsageChart() {
  return useQuery({
    queryKey: [QK, "module-usage"],
    queryFn:  dashboardApi.getModuleUsageChart,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: [QK, "activity"],
    queryFn:  dashboardApi.getRecentActivity,
    staleTime: 60 * 1000,
  });
}

export function useTopPerformers() {
  return useQuery({
    queryKey: [QK, "top-performers"],
    queryFn:  dashboardApi.getTopPerformers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpcomingPayments() {
  return useQuery({
    queryKey: [QK, "upcoming-payments"],
    queryFn:  dashboardApi.getUpcomingPayments,
    staleTime: 2 * 60 * 1000,
  });
}
