import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/inventory/transfers`;

export type TransferStatus = "draft" | "pending" | "in_transit" | "received" | "cancelled";

export interface TransferItemDto {
  id: string;
  stockItemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface StockTransferDto {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: TransferStatus;
  requestedBy: string;
  approvedBy: string | null;
  requestDate: string;
  expectedDate: string;
  receivedDate: string | null;
  items: TransferItemDto[];
  totalValue: number;
  notes: string;
}

export interface TransferSummaryDto {
  total: number;
  pending: number;
  inTransit: number;
  received: number;
  totalValue: number;
  avgTransferValue: number;
}

export interface CreateTransferRequest {
  fromWarehouseId: string;
  toWarehouseId: string;
  expectedDate: string;
  notes?: string;
  items: { stockItemId: string; quantity: number; unitCost: number }[];
}

export const transfersApi = {
  getAll: (params?: { page?: number; pageSize?: number; status?: string }): Promise<PagedResult<StockTransferDto>> => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set("page",     String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.status)   qs.set("status",   params.status);
    return rawApiClient.get<PagedResult<StockTransferDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<StockTransferDto> =>
    rawApiClient.get<StockTransferDto>(`${BASE}/${id}`),

  create: (data: CreateTransferRequest): Promise<StockTransferDto> =>
    rawApiClient.post<StockTransferDto>(BASE, data),

  approve: (id: string): Promise<StockTransferDto> =>
    rawApiClient.put<StockTransferDto>(`${BASE}/${id}/approve`, {}),

  receive: (id: string): Promise<StockTransferDto> =>
    rawApiClient.put<StockTransferDto>(`${BASE}/${id}/receive`, {}),

  getSummary: (): Promise<TransferSummaryDto> =>
    rawApiClient.get<TransferSummaryDto>(`${BASE}/summary`),
};
