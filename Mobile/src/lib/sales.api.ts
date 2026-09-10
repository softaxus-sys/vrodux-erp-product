import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  ConvertQuotationResultDto,
  QuotationDto,
  QuotationsPageParams,
  QuotationSummaryDto,
  SalesOrderDto,
  SalesOrdersPageParams,
  SalesOrderSummaryDto,
} from "@/types/sales";

const BASE = "/api/sales";

export const SALES_ORDERS_VIEW = "sales.orders.view";
export const SALES_ORDERS_EDIT = "sales.orders.edit";
export const SALES_QUOTATIONS_VIEW = "sales.quotations.view";
export const SALES_QUOTATIONS_EDIT = "sales.quotations.edit";

function buildOrdersQuery(p: SalesOrdersPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  return qs.toString();
}

function buildQuotationsQuery(p: QuotationsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  return qs.toString();
}

export const salesApi = {
  // ── Orders ─────────────────────────────────────────────────────────────
  getOrders: (params: SalesOrdersPageParams = {}): Promise<PagedResult<SalesOrderSummaryDto>> =>
    apiClient.get(`${BASE}/orders?${buildOrdersQuery(params)}`),

  getOrder: (id: string): Promise<SalesOrderDto> => apiClient.get(`${BASE}/orders/${id}`),

  // Bare JSON string body, not { status } -- see purchase.api.ts's setOrderStatus for why.
  setOrderStatus: (id: string, status: string): Promise<void> =>
    apiClient.patch(`${BASE}/orders/${id}/status`, status),

  // ── Quotations ─────────────────────────────────────────────────────────
  getQuotations: (params: QuotationsPageParams = {}): Promise<PagedResult<QuotationSummaryDto>> =>
    apiClient.get(`${BASE}/quotations?${buildQuotationsQuery(params)}`),

  getQuotation: (id: string): Promise<QuotationDto> => apiClient.get(`${BASE}/quotations/${id}`),

  sendQuotation: (id: string, toEmail?: string): Promise<{ emailSent: boolean; sentTo: string | null; url: string; warning?: string | null }> =>
    apiClient.post(`${BASE}/quotations/${id}/send`, toEmail ? { toEmail } : {}),

  /** Records a decision the customer gave off-platform (phone, meeting, reply). */
  respondToQuotation: (id: string, accepted: boolean, byName: string, comment?: string): Promise<QuotationDto> =>
    apiClient.post(`${BASE}/quotations/${id}/respond`, { accepted, byName, comment: comment ?? null }),

  convertQuotation: (id: string): Promise<ConvertQuotationResultDto> =>
    apiClient.post(`${BASE}/quotations/${id}/convert`),
};
