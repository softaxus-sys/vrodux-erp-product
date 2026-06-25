import { apiClient, type PagedResult } from "@/lib/api-client";
import type { PurchaseOrderDto, PurchaseOrderSummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase-orders`;

export interface GetPurchaseOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface OrderItemPayload {
  productId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
}

export interface CreatePurchaseOrderPayload {
  vendorId: string;
  notes?: string | null;
  expectedDate?: string | null;
  items: OrderItemPayload[];
}

export interface UpdatePurchaseOrderPayload {
  vendorId: string;
  status: string;
  notes?: string | null;
  expectedDate?: string | null;
  items: OrderItemPayload[];
}

export const purchaseOrdersApi = {
  getAll: (params: GetPurchaseOrdersParams = {}): Promise<PagedResult<PurchaseOrderSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.status)   qs.set("status",   params.status);
    if (params.vendorId) qs.set("vendorId", params.vendorId);
    if (params.from)     qs.set("from",     params.from);
    if (params.to)       qs.set("to",       params.to);
    if (params.search)   qs.set("search",   params.search);
    return apiClient.get<PagedResult<PurchaseOrderSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<PurchaseOrderDto> =>
    apiClient.get<PurchaseOrderDto>(`${BASE}/${id}`),

  create: (payload: CreatePurchaseOrderPayload): Promise<{ id: string; orderNumber: string }> =>
    apiClient.post<{ id: string; orderNumber: string }>(BASE, payload),

  update: (id: string, payload: UpdatePurchaseOrderPayload): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  updateStatus: (id: string, status: string): Promise<void> =>
    apiClient.patch<void>(`${BASE}/${id}/status`, JSON.stringify(status)),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
