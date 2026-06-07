import { rawApiClient } from "@/lib/api-client";
import type { KpiCard, ChartDataPoint, ActivityItem } from "@/types";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/dashboard`;

export interface TopPerformerDto {
  name: string;
  role: string;
  revenue: number;
  deals: number;
}

export interface UpcomingPaymentDto {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  status: "pending" | "overdue" | "paid";
}

export const dashboardApi = {
  getKpiCards: (): Promise<KpiCard[]> =>
    rawApiClient.get<KpiCard[]>(`${BASE}/kpis`),

  getRevenueChart: (): Promise<ChartDataPoint[]> =>
    rawApiClient.get<ChartDataPoint[]>(`${BASE}/revenue-chart`),

  getModuleUsageChart: (): Promise<ChartDataPoint[]> =>
    rawApiClient.get<ChartDataPoint[]>(`${BASE}/module-usage`),

  getRecentActivity: (): Promise<ActivityItem[]> =>
    rawApiClient.get<ActivityItem[]>(`${BASE}/activity`),

  getTopPerformers: (): Promise<TopPerformerDto[]> =>
    rawApiClient.get<TopPerformerDto[]>(`${BASE}/top-performers`),

  getUpcomingPayments: (): Promise<UpcomingPaymentDto[]> =>
    rawApiClient.get<UpcomingPaymentDto[]>(`${BASE}/upcoming-payments`),
};
