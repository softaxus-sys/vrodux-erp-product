import { apiClient, rawApiClient } from "@/lib/api-client";
import type { DailySummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/reports`;

// â”€â”€ Report filter params (mirrors backend ReportParams) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReportRunParams {
  from?: string;            // yyyy-MM-dd
  to?: string;              // yyyy-MM-dd
  cashierId?: string;
  categoryId?: string;
  warehouseId?: string;
  paymentMethod?: string;
  status?: string;
  taxPeriod?: string;
  valuationMethod?: string;
  fiscalYear?: string;
  idleDays?: number;
}

// â”€â”€ Generic report result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
}

// â”€â”€ API functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const reportsApi = {
  /** Legacy: cashier dashboard daily summary */
  getDailySummary: (params: { date?: string; sessionId?: string } = {}): Promise<DailySummaryDto> => {
    const qs = new URLSearchParams();
    if (params.date)      qs.set("date",      params.date);
    if (params.sessionId) qs.set("sessionId", params.sessionId);
    return apiClient.get<DailySummaryDto>(`${BASE}/daily-summary?${qs}`);
  },

  /**
   * Run any POS report by its registry ID. The controller returns raw JSON (no ApiResponse
   * envelope) via `Ok(result)` directly — using the enveloped `apiClient` here would make every
   * successful 200 read as `!body.success` and throw. `rawApiClient` matches what the controller
   * actually sends, same as `inventoryReportsApi.run` does for its own (also raw) controller.
   */
  run: (reportId: string, params: ReportRunParams = {}): Promise<ReportResult> => {
    const qs = new URLSearchParams();
    if (params.from)             qs.set("from",            params.from);
    if (params.to)               qs.set("to",              params.to);
    if (params.cashierId)        qs.set("cashierId",       params.cashierId);
    if (params.categoryId)       qs.set("categoryId",      params.categoryId);
    if (params.warehouseId)      qs.set("warehouseId",     params.warehouseId);
    if (params.paymentMethod)    qs.set("paymentMethod",   params.paymentMethod);
    if (params.status)           qs.set("status",          params.status);
    if (params.taxPeriod)        qs.set("taxPeriod",       params.taxPeriod);
    if (params.valuationMethod)  qs.set("valuationMethod", params.valuationMethod);
    if (params.fiscalYear)       qs.set("fiscalYear",      params.fiscalYear);
    if (params.idleDays != null) qs.set("idleDays",        String(params.idleDays));
    return rawApiClient.get<ReportResult>(`${BASE}/${encodeURIComponent(reportId)}?${qs}`);
  },
};
