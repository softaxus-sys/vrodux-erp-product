import { useQuery } from "@tanstack/react-query";
import { reportsApi, dashboardApi, type ReportRangeParams } from "@/lib/restaurant/reports.api";

export const reportKeys = {
  all:             ["restaurant-reports"] as const,
  salesDaily:      (p: ReportRangeParams) => [...reportKeys.all, "sales-daily", p] as const,
  salesByCategory: (p: ReportRangeParams) => [...reportKeys.all, "sales-by-category", p] as const,
  salesByEmployee: (p: ReportRangeParams) => [...reportKeys.all, "sales-by-employee", p] as const,
  voidsDiscounts:  (p: ReportRangeParams) => [...reportKeys.all, "voids-discounts", p] as const,
  kitchenPrep:     (p: ReportRangeParams) => [...reportKeys.all, "kitchen-prep", p] as const,
  tableTurnover:   (p: ReportRangeParams) => [...reportKeys.all, "table-turnover", p] as const,
  taxSummary:      (p: ReportRangeParams) => [...reportKeys.all, "tax-summary", p] as const,
  xReport:         (sessionId: string) => [...reportKeys.all, "x-report", sessionId] as const,
  zReport:         (sessionId: string) => [...reportKeys.all, "z-report", sessionId] as const,
  ownerDashboard:    (branchId?: string | null) => [...reportKeys.all, "dashboard-owner", branchId ?? null] as const,
  branchDashboard:   (branchId?: string | null) => [...reportKeys.all, "dashboard-branch", branchId ?? null] as const,
  kitchenDashboard:  (branchId?: string | null) => [...reportKeys.all, "dashboard-kitchen", branchId ?? null] as const,
  cashierDashboard:  (sessionId?: string | null) => [...reportKeys.all, "dashboard-cashier", sessionId ?? null] as const,
  inventoryDashboard:() => [...reportKeys.all, "dashboard-inventory"] as const,
};

export const useSalesDailyReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.salesDaily(p), queryFn: () => reportsApi.salesDaily(p), enabled });

export const useSalesByCategoryReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.salesByCategory(p), queryFn: () => reportsApi.salesByCategory(p), enabled });

export const useSalesByEmployeeReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.salesByEmployee(p), queryFn: () => reportsApi.salesByEmployee(p), enabled });

export const useVoidsDiscountsReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.voidsDiscounts(p), queryFn: () => reportsApi.voidsDiscounts(p), enabled });

export const useKitchenPrepTimesReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.kitchenPrep(p), queryFn: () => reportsApi.kitchenPrepTimes(p), enabled });

export const useTableTurnoverReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.tableTurnover(p), queryFn: () => reportsApi.tableTurnover(p), enabled });

export const useTaxSummaryReport = (p: ReportRangeParams, enabled = true) =>
  useQuery({ queryKey: reportKeys.taxSummary(p), queryFn: () => reportsApi.taxSummary(p), enabled });

export const useXReport = (sessionId: string, enabled = true) =>
  useQuery({ queryKey: reportKeys.xReport(sessionId), queryFn: () => reportsApi.xReport(sessionId), enabled: enabled && !!sessionId });

export const useZReport = (sessionId: string, enabled = true) =>
  useQuery({ queryKey: reportKeys.zReport(sessionId), queryFn: () => reportsApi.zReport(sessionId), enabled: enabled && !!sessionId });

export const useOwnerDashboard = (branchId?: string | null, enabled = true) =>
  useQuery({ queryKey: reportKeys.ownerDashboard(branchId), queryFn: () => dashboardApi.owner(branchId), enabled });

export const useBranchDashboard = (branchId?: string | null, enabled = true) =>
  useQuery({ queryKey: reportKeys.branchDashboard(branchId), queryFn: () => dashboardApi.branch(branchId), enabled });

export const useKitchenDashboard = (branchId?: string | null, enabled = true) =>
  useQuery({ queryKey: reportKeys.kitchenDashboard(branchId), queryFn: () => dashboardApi.kitchen(branchId), enabled });

export const useCashierDashboard = (sessionId?: string | null, enabled = true) =>
  useQuery({ queryKey: reportKeys.cashierDashboard(sessionId), queryFn: () => dashboardApi.cashier(sessionId), enabled });

export const useInventoryDashboard = (enabled = true) =>
  useQuery({ queryKey: reportKeys.inventoryDashboard(), queryFn: dashboardApi.inventory, enabled });
