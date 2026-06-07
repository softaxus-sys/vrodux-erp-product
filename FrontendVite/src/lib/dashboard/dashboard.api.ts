import { rawApiClient } from "@/lib/api-client";
import type { KpiCard, ChartDataPoint, ActivityItem } from "@/types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/dashboard`;

export interface TopPerformerDto {
  name:    string;
  role:    string;
  revenue: number;
  deals:   number;
}

export interface UpcomingPaymentDto {
  id:      string;
  vendor:  string;
  amount:  number;
  dueDate: string;
  status:  "pending" | "overdue" | "paid";
}

export const dashboardApi = {
  getKpiCards:         (): Promise<KpiCard[]>             => rawApiClient.get(`${BASE}/kpis`),
  getRevenueChart:     (): Promise<ChartDataPoint[]>      => rawApiClient.get(`${BASE}/revenue-chart`),
  getModuleUsageChart: (): Promise<ChartDataPoint[]>      => rawApiClient.get(`${BASE}/module-usage`),
  getRecentActivity:   (): Promise<ActivityItem[]>        => rawApiClient.get(`${BASE}/activity`),
  getTopPerformers:    (): Promise<TopPerformerDto[]>     => rawApiClient.get(`${BASE}/top-performers`),
  getUpcomingPayments: (): Promise<UpcomingPaymentDto[]>  => rawApiClient.get(`${BASE}/upcoming-payments`),
};
