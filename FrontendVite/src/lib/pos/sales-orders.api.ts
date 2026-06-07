import { apiClient, type PagedResult } from "@/lib/api-client";
import type { SalesOrderDto, SalesOrderSummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales-orders`;

export interface GetSalesOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface SalesOrderItemPayload {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface CreateSalesOrderPayload {
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  expectedDate?: string | null;
  items: SalesOrderItemPayload[];
}

export interface UpdateSalesOrderPayload {
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  notes?: string | null;
  expectedDate?: string | null;
  items: SalesOrderItemPayload[];
}

export const salesOrdersApi = {
  getAll: (params: GetSalesOrdersParams = {}): Promise<PagedResult<SalesOrderSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.status)     qs.set("status",     params.status);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.from)       qs.set("from",       params.from);
    if (params.to)         qs.set("to",         params.to);
    if (params.search)     qs.set("search",     params.search);
    return apiClient.get<PagedResult<SalesOrderSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<SalesOrderDto> =>
    apiClient.get<SalesOrderDto>(`${BASE}/${id}`),

  create: (payload: CreateSalesOrderPayload): Promise<{ id: string; orderNumber: string }> =>
    apiClient.post<{ id: string; orderNumber: string }>(BASE, payload),

  update: (id: string, payload: UpdateSalesOrderPayload): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
