import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase/returns`;

export interface PurchaseReturnItemDto {
  id: string;
  purchaseOrderItemId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseReturnDto {
  id: string;
  returnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  vendorName: string;
  returnDate: string;
  reason: string;
  notes: string | null;
  status: string;
  totalAmount: number;
  items: PurchaseReturnItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface PurchaseReturnSummaryDto {
  id: string;
  returnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  vendorName: string;
  returnDate: string;
  reason: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

export interface PurchaseReturnItemRequest {
  purchaseOrderItemId?: string | null;
  productId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseReturnRequest {
  purchaseOrderId: string;
  returnDate: string;
  reason: string;
  notes?: string | null;
  items: PurchaseReturnItemRequest[];
}

export interface GetPurchaseReturnsParams {
  purchaseOrderId?: string;
  vendorId?: string;
}

export const purchaseReturnsApi = {
  getAll: (params: GetPurchaseReturnsParams = {}): Promise<PurchaseReturnSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params.purchaseOrderId) qs.set("purchaseOrderId", params.purchaseOrderId);
    if (params.vendorId)        qs.set("vendorId", params.vendorId);
    const query = qs.toString();
    return rawApiClient.get<PurchaseReturnSummaryDto[]>(`${BASE}${query ? `?${query}` : ""}`);
  },

  getById: (id: string): Promise<PurchaseReturnDto> =>
    rawApiClient.get<PurchaseReturnDto>(`${BASE}/${id}`),

  create: (payload: CreatePurchaseReturnRequest): Promise<PurchaseReturnDto> =>
    rawApiClient.post<PurchaseReturnDto>(BASE, payload),
};
