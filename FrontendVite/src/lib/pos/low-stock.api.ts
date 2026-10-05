import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/pos-dashboard`;

export interface LowStockItemDto {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  /** How far below the reorder level; 0 when no level is set. */
  shortage: number;
  /** Units sold at the till in the last `salesDays` days. */
  soldInPeriod: number;
  /** Enough to reach the larger of 2× reorder level and the period's sales. */
  suggestedOrderQty: number;
  costPrice: number;
  estimatedCost: number;
  status: "out" | "low";
}

export interface LowStockReportDto {
  salesDays: number;
  outOfStockCount: number;
  lowStockCount: number;
  estimatedCost: number;
  items: LowStockItemDto[];
}

export const lowStockApi = {
  getReport: (salesDays: number): Promise<LowStockReportDto> =>
    apiClient.get<LowStockReportDto>(`${BASE}/low-stock?salesDays=${salesDays}`),
};
