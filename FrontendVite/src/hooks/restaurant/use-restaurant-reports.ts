import { useQuery } from "@tanstack/react-query";
import { reportsApi, dashboardApi, type ReportRangeParams } from "@/lib/restaurant/reports.api";
import { useActiveBranchId } from "@/hooks/restaurant/use-restaurant";

/** Reports cover the branch selected in the switcher unless the caller names one. A user assigned to
 * branches always has one selected — the server refuses their reports otherwise. */
function useWithBranch(p: ReportRangeParams): ReportRangeParams {
  const active = useActiveBranchId();
  return { ...p, branchId: p.branchId ?? active };
}
function useBranchOrActive(branchId?: string | null): string | null {
  const active = useActiveBranchId();
  return branchId ?? active;
}

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

export const useSalesDailyReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.salesDaily(q), queryFn: () => reportsApi.salesDaily(q), enabled });
};

export const useSalesByCategoryReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.salesByCategory(q), queryFn: () => reportsApi.salesByCategory(q), enabled });
};

export const useSalesByEmployeeReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.salesByEmployee(q), queryFn: () => reportsApi.salesByEmployee(q), enabled });
};

export const useVoidsDiscountsReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.voidsDiscounts(q), queryFn: () => reportsApi.voidsDiscounts(q), enabled });
};

export const useKitchenPrepTimesReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.kitchenPrep(q), queryFn: () => reportsApi.kitchenPrepTimes(q), enabled });
};

export const useTableTurnoverReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.tableTurnover(q), queryFn: () => reportsApi.tableTurnover(q), enabled });
};

export const useTaxSummaryReport = (p: ReportRangeParams, enabled = true) => {
  const q = useWithBranch(p);
  return useQuery({ queryKey: reportKeys.taxSummary(q), queryFn: () => reportsApi.taxSummary(q), enabled });
};

export const useReportShifts = () =>
  useQuery({ queryKey: [...reportKeys.all, "shifts"], queryFn: () => reportsApi.shifts() });

export const useXReport = (sessionId: string, enabled = true) =>
  useQuery({ queryKey: reportKeys.xReport(sessionId), queryFn: () => reportsApi.xReport(sessionId), enabled: enabled && !!sessionId });

export const useZReport = (sessionId: string, enabled = true) =>
  useQuery({ queryKey: reportKeys.zReport(sessionId), queryFn: () => reportsApi.zReport(sessionId), enabled: enabled && !!sessionId });

export const useOwnerDashboard = (branchId?: string | null, enabled = true) => {
  const b = useBranchOrActive(branchId);
  return useQuery({ queryKey: reportKeys.ownerDashboard(b), queryFn: () => dashboardApi.owner(b), enabled });
};

export const useBranchDashboard = (branchId?: string | null, enabled = true) => {
  const b = useBranchOrActive(branchId);
  return useQuery({ queryKey: reportKeys.branchDashboard(b), queryFn: () => dashboardApi.branch(b), enabled });
};

export const useKitchenDashboard = (branchId?: string | null, enabled = true) => {
  const b = useBranchOrActive(branchId);
  return useQuery({ queryKey: reportKeys.kitchenDashboard(b), queryFn: () => dashboardApi.kitchen(b), enabled });
};

export const useCashierDashboard = (sessionId?: string | null, enabled = true) =>
  useQuery({ queryKey: reportKeys.cashierDashboard(sessionId), queryFn: () => dashboardApi.cashier(sessionId), enabled });

export const useInventoryDashboard = (enabled = true) =>
  useQuery({ queryKey: reportKeys.inventoryDashboard(), queryFn: dashboardApi.inventory, enabled });
