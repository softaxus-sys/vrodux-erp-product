import { apiClient, type PagedResult } from "@/lib/api-client";
import type { SalesQuotationDto, SalesQuotationSummaryDto } from "./types";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/sales-quotations`;

export interface GetSalesQuotationsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface QuotationItemPayload {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface CreateQuotationPayload {
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  items: QuotationItemPayload[];
}

export interface UpdateQuotationPayload {
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  notes?: string | null;
  validUntil?: string | null;
  items: QuotationItemPayload[];
}

export const salesQuotationsApi = {
  getAll: (params: GetSalesQuotationsParams = {}): Promise<PagedResult<SalesQuotationSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.status)     qs.set("status",     params.status);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.from)       qs.set("from",       params.from);
    if (params.to)         qs.set("to",         params.to);
    if (params.search)     qs.set("search",     params.search);
    return apiClient.get<PagedResult<SalesQuotationSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<SalesQuotationDto> =>
    apiClient.get<SalesQuotationDto>(`${BASE}/${id}`),

  create: (payload: CreateQuotationPayload): Promise<{ id: string; quotationNumber: string }> =>
    apiClient.post<{ id: string; quotationNumber: string }>(BASE, payload),

  update: (id: string, payload: UpdateQuotationPayload): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  convertToOrder: (id: string): Promise<{ salesOrderId: string; orderNumber: string }> =>
    apiClient.post<{ salesOrderId: string; orderNumber: string }>(`${BASE}/${id}/convert`, {}),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
