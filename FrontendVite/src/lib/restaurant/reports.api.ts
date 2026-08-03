import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant`;

// ── Report row types (mirror the backend Reports/Dtos) ─────────────────────────

export interface SalesDailyRow {
  date: string;
  orderCount: number;
  grossSales: number;
  discounts: number;
  tax: number;
  netSales: number;
}

export interface SalesByCategoryRow {
  categoryId: string;
  categoryName: string;
  qty: number;
  revenue: number;
}

export interface SalesByEmployeeRow {
  waiter: string;
  orderCount: number;
  revenue: number;
  tipTotal: number;
}

export interface VoidsAndDiscountsRow {
  userId: string;
  voidCount: number;
  voidValue: number;
  discountCount: number;
  discountValue: number;
}

export interface KitchenPrepTimeRow {
  menuItemId: string;
  menuItemName: string;
  ordersCount: number;
  avgPrepMinutes: number;
  p90PrepMinutes: number;
}

export interface TableTurnoverRow {
  tableId: string;
  tableNumber: string;
  turnCount: number;
  avgOccupiedMinutes: number;
}

export interface TaxSummaryRow {
  date: string;
  taxableAmount: number;
  taxCollected: number;
}

export interface SessionReportDto {
  sessionId: string;
  sessionStatus: "open" | "closed" | "unknown";
  orderCount: number;
  grossSales: number;
  discounts: number;
  tax: number;
  tips: number;
  refunds: number;
  netSales: number;
  voidCount: number;
  voidValue: number;
  paymentMethodBreakdown: Record<string, number>;
}

// ── Dashboard types ──────────────────────────────────────────────────────────

export interface OwnerDashboardDto {
  todaySales: number;
  todayOrders: number;
  todayNetSales: number;
  weekSales: number;
  weekNetSales: number;
  weekDiscounts: number;
  weekVoidValue: number;
  topCategoriesWeek: SalesByCategoryRow[];
}

export interface BranchDashboardDto {
  branchId: string | null;
  todaySales: number;
  todayOrders: number;
  todayNetSales: number;
  tablesAvailable: number;
  tablesOccupied: number;
  tablesReserved: number;
  tablesCleaning: number;
  activeOrders: number;
}

export interface KitchenDashboardDto {
  activeTickets: number;
  pendingItems: number;
  preparingItems: number;
  readyItems: number;
  avgPrepMinutesToday: number;
  slowestItemsToday: KitchenPrepTimeRow[];
}

export interface CashierDashboardDto {
  todayOrders: number;
  todaySales: number;
  currentSession: SessionReportDto | null;
}

export interface LowStockItemRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  reorderLevel: number;
}

export interface InventoryDashboardDto {
  lowStockCount: number;
  lowStockItems: LowStockItemRow[];
  eightySixedCount: number;
  eightySixedItemNames: string[];
}

// ── API ──────────────────────────────────────────────────────────────────────

export interface ReportRangeParams {
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  branchId?: string | null;
}

function rangeQs({ from, to, branchId }: ReportRangeParams): string {
  const p = new URLSearchParams({ from, to });
  if (branchId) p.set("branchId", branchId);
  return p.toString();
}

export const reportsApi = {
  salesDaily:       (p: ReportRangeParams): Promise<SalesDailyRow[]> =>
    rawApiClient.get(`${BASE}/reports/sales-daily?${rangeQs(p)}`),
  salesByCategory:  (p: ReportRangeParams): Promise<SalesByCategoryRow[]> =>
    rawApiClient.get(`${BASE}/reports/sales-by-category?${rangeQs(p)}`),
  salesByEmployee:  (p: ReportRangeParams): Promise<SalesByEmployeeRow[]> =>
    rawApiClient.get(`${BASE}/reports/sales-by-employee?${rangeQs(p)}`),
  voidsDiscounts:   (p: ReportRangeParams): Promise<VoidsAndDiscountsRow[]> =>
    rawApiClient.get(`${BASE}/reports/voids-discounts?${rangeQs(p)}`),
  kitchenPrepTimes: (p: ReportRangeParams): Promise<KitchenPrepTimeRow[]> =>
    rawApiClient.get(`${BASE}/reports/kitchen-prep-times?${rangeQs(p)}`),
  tableTurnover:    (p: ReportRangeParams): Promise<TableTurnoverRow[]> =>
    rawApiClient.get(`${BASE}/reports/table-turnover?${rangeQs(p)}`),
  taxSummary:       (p: ReportRangeParams): Promise<TaxSummaryRow[]> =>
    rawApiClient.get(`${BASE}/reports/tax-summary?${rangeQs(p)}`),
  xReport:          (sessionId: string): Promise<SessionReportDto> =>
    rawApiClient.get(`${BASE}/reports/x-report?sessionId=${sessionId}`),
  zReport:          (sessionId: string): Promise<SessionReportDto> =>
    rawApiClient.get(`${BASE}/reports/z-report?sessionId=${sessionId}`),
};

export const dashboardApi = {
  owner:     (branchId?: string | null): Promise<OwnerDashboardDto> =>
    rawApiClient.get(`${BASE}/dashboard/owner${branchId ? `?branchId=${branchId}` : ""}`),
  branch:    (branchId?: string | null): Promise<BranchDashboardDto> =>
    rawApiClient.get(`${BASE}/dashboard/branch${branchId ? `?branchId=${branchId}` : ""}`),
  kitchen:   (branchId?: string | null): Promise<KitchenDashboardDto> =>
    rawApiClient.get(`${BASE}/dashboard/kitchen${branchId ? `?branchId=${branchId}` : ""}`),
  cashier:   (sessionId?: string | null): Promise<CashierDashboardDto> =>
    rawApiClient.get(`${BASE}/dashboard/cashier${sessionId ? `?sessionId=${sessionId}` : ""}`),
  inventory: (): Promise<InventoryDashboardDto> =>
    rawApiClient.get(`${BASE}/dashboard/inventory`),
};
