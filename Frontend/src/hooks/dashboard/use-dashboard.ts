import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/dashboard/dashboard.api";

export const dashboardKeys = {
  all:              ["dashboard"] as const,
  kpis:             () => [...dashboardKeys.all, "kpis"] as const,
  revenueChart:     () => [...dashboardKeys.all, "revenue-chart"] as const,
  moduleUsageChart: () => [...dashboardKeys.all, "module-usage"] as const,
  recentActivity:   () => [...dashboardKeys.all, "activity"] as const,
  topPerformers:    () => [...dashboardKeys.all, "top-performers"] as const,
  upcomingPayments: () => [...dashboardKeys.all, "upcoming-payments"] as const,
};

export function useKpiCards() {
  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn:  () => dashboardApi.getKpiCards(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRevenueChart() {
  return useQuery({
    queryKey: dashboardKeys.revenueChart(),
    queryFn:  () => dashboardApi.getRevenueChart(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useModuleUsageChart() {
  return useQuery({
    queryKey: dashboardKeys.moduleUsageChart(),
    queryFn:  () => dashboardApi.getModuleUsageChart(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.recentActivity(),
    queryFn:  () => dashboardApi.getRecentActivity(),
    staleTime: 60 * 1000, // 1 minute — activity updates frequently
  });
}

export function useTopPerformers() {
  return useQuery({
    queryKey: dashboardKeys.topPerformers(),
    queryFn:  () => dashboardApi.getTopPerformers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpcomingPayments() {
  return useQuery({
    queryKey: dashboardKeys.upcomingPayments(),
    queryFn:  () => dashboardApi.getUpcomingPayments(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
