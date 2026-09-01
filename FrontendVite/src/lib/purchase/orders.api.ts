import { rawApiClient, type PagedResult } from "@/lib/api-client";
import type { PurchaseOrderDto, PurchaseOrderSummaryDto } from "@/lib/pos/types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase/orders`;

export interface GetPurchaseOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  vendorId?: string;
  search?: string;
}

export interface PurchaseOrderItemRequest {
  productId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
}

export interface CreatePurchaseOrderRequest {
  vendorId: string;
  notes?: string | null;
  expectedDate?: string | null;
  items: PurchaseOrderItemRequest[];
}

export interface UpdatePurchaseOrderRequest extends CreatePurchaseOrderRequest {
  status: string;
}

export interface MonthlyPurchaseDto { month: number; amount: number; orders: number; }
export interface VendorSpendDto { vendor: string; amount: number; orders: number; }
export interface PurchaseDashboardDto { monthly: MonthlyPurchaseDto[]; topVendors: VendorSpendDto[]; }

// Its own controller — the orders one injects a DbContext directly and is flagged tech debt.
const DASHBOARD = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase/dashboard`;

export const purchaseOrdersApi = {
  /** Monthly spend and the biggest vendors, aggregated in SQL for the dashboard charts. */
  getDashboard: (year?: number): Promise<PurchaseDashboardDto> =>
    rawApiClient.get(`${DASHBOARD}${year ? `?year=${year}` : ""}`),

  getAll: (params: GetPurchaseOrdersParams = {}): Promise<PagedResult<PurchaseOrderSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.status)   qs.set("status",   params.status);
    if (params.vendorId) qs.set("vendorId", params.vendorId);
    if (params.search)   qs.set("search",   params.search);
    return rawApiClient.get<PagedResult<PurchaseOrderSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<PurchaseOrderDto> =>
    rawApiClient.get<PurchaseOrderDto>(`${BASE}/${id}`),

  create: (payload: CreatePurchaseOrderRequest): Promise<PurchaseOrderDto> =>
    rawApiClient.post<PurchaseOrderDto>(BASE, payload),

  update: (id: string, payload: UpdatePurchaseOrderRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, payload),

  updateStatus: (id: string, status: string): Promise<void> =>
    rawApiClient.patch<void>(`${BASE}/${id}/status`, status),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
