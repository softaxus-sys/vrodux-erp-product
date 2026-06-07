import { rawApiClient, type PagedResult } from "@/lib/api-client";
import type { SalesOrderDto, SalesOrderSummaryDto } from "@/lib/pos/types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/orders`;

export interface GetSalesOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
  search?: string;
}

export interface OrderItemRequest {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface CreateSalesOrderRequest {
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  expectedDate?: string | null;
  items: OrderItemRequest[];
}

export interface UpdateSalesOrderRequest extends CreateSalesOrderRequest {
  status: string;
}

export const salesOrdersApi = {
  getAll: (params: GetSalesOrdersParams = {}): Promise<PagedResult<SalesOrderSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.status)     qs.set("status",     params.status);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.search)     qs.set("search",     params.search);
    return rawApiClient.get<PagedResult<SalesOrderSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<SalesOrderDto> =>
    rawApiClient.get<SalesOrderDto>(`${BASE}/${id}`),

  create: (payload: CreateSalesOrderRequest): Promise<SalesOrderDto> =>
    rawApiClient.post<SalesOrderDto>(BASE, payload),

  update: (id: string, payload: UpdateSalesOrderRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, payload),

  updateStatus: (id: string, status: string): Promise<void> =>
    rawApiClient.patch<void>(`${BASE}/${id}/status`, status),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
