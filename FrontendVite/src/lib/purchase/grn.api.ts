import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase/grn`;

export interface GoodsReceiptNoteItemDto {
  id: string;
  purchaseOrderItemId: string | null;
  productId: string | null;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface GoodsReceiptNoteDto {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  vendorName: string;
  grnDate: string;
  driverName: string | null;
  notes: string | null;
  status: string;
  items: GoodsReceiptNoteItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface GoodsReceiptNoteSummaryDto {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  vendorName: string;
  grnDate: string;
  driverName: string | null;
  status: string;
  itemCount: number;
  createdAt: string;
}

export interface GoodsReceiptNoteItemRequest {
  purchaseOrderItemId?: string | null;
  productId?: string | null;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
}

export interface CreateGoodsReceiptNoteRequest {
  purchaseOrderId: string;
  grnDate: string;
  driverName?: string | null;
  notes?: string | null;
  items: GoodsReceiptNoteItemRequest[];
}

export interface GetGoodsReceiptNotesParams {
  purchaseOrderId?: string;
  vendorId?: string;
}

export const goodsReceiptNotesApi = {
  getAll: (params: GetGoodsReceiptNotesParams = {}): Promise<GoodsReceiptNoteSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params.purchaseOrderId) qs.set("purchaseOrderId", params.purchaseOrderId);
    if (params.vendorId)        qs.set("vendorId", params.vendorId);
    const query = qs.toString();
    return rawApiClient.get<GoodsReceiptNoteSummaryDto[]>(`${BASE}${query ? `?${query}` : ""}`);
  },

  getById: (id: string): Promise<GoodsReceiptNoteDto> =>
    rawApiClient.get<GoodsReceiptNoteDto>(`${BASE}/${id}`),

  create: (payload: CreateGoodsReceiptNoteRequest): Promise<GoodsReceiptNoteDto> =>
    rawApiClient.post<GoodsReceiptNoteDto>(BASE, payload),
};
