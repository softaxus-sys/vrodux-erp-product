import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  PurchaseOrderDto,
  PurchaseOrdersPageParams,
  PurchaseOrderSummaryDto,
  VendorDto,
  VendorsPageParams,
} from "@/types/purchase";

const BASE = "/api/purchase";

export const PURCHASE_ORDERS_VIEW = "purchase.orders.view";
export const PURCHASE_ORDERS_EDIT = "purchase.orders.edit";
export const PURCHASE_VENDORS_VIEW = "purchase.vendors.view";

function buildOrdersQuery(p: PurchaseOrdersPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  return qs.toString();
}

function buildVendorsQuery(p: VendorsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  return qs.toString();
}

export const purchaseApi = {
  getOrders: (params: PurchaseOrdersPageParams = {}): Promise<PagedResult<PurchaseOrderSummaryDto>> =>
    apiClient.get(`${BASE}/orders?${buildOrdersQuery(params)}`),

  getOrder: (id: string): Promise<PurchaseOrderDto> => apiClient.get(`${BASE}/orders/${id}`),

  // The endpoint binds a bare JSON string, not { status } -- passing the string itself as the
  // body makes apiClient.patch's JSON.stringify produce exactly that (`"sent"`, not `{"status":"sent"}`).
  setOrderStatus: (id: string, status: string): Promise<void> =>
    apiClient.patch(`${BASE}/orders/${id}/status`, status),

  getVendors: (params: VendorsPageParams = {}): Promise<PagedResult<VendorDto>> =>
    apiClient.get(`${BASE}/vendors?${buildVendorsQuery(params)}`),

  getVendor: (id: string): Promise<VendorDto> => apiClient.get(`${BASE}/vendors/${id}`),
};
