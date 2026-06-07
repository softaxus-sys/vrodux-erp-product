import { rawApiClient, type PagedResult } from "@/lib/api-client";
import type { SalesQuotationDto, SalesQuotationSummaryDto } from "@/lib/pos/types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/quotations`;

export interface GetSalesQuotationsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
  search?: string;
}

export interface QuotationItemRequest {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface CreateSalesQuotationRequest {
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  discountPercent: number;
  items: QuotationItemRequest[];
}

export interface UpdateSalesQuotationRequest extends CreateSalesQuotationRequest {
  status: string;
}

export const salesQuotationsApi = {
  getAll: (params: GetSalesQuotationsParams = {}): Promise<PagedResult<SalesQuotationSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.status)     qs.set("status",     params.status);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.search)     qs.set("search",     params.search);
    return rawApiClient.get<PagedResult<SalesQuotationSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<SalesQuotationDto> =>
    rawApiClient.get<SalesQuotationDto>(`${BASE}/${id}`),

  create: (payload: CreateSalesQuotationRequest): Promise<SalesQuotationDto> =>
    rawApiClient.post<SalesQuotationDto>(BASE, payload),

  update: (id: string, payload: UpdateSalesQuotationRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, payload),

  convertToOrder: (id: string): Promise<{ orderId: string; orderNumber: string }> =>
    rawApiClient.post<{ orderId: string; orderNumber: string }>(`${BASE}/${id}/convert`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
