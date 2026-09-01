import { rawApiClient } from "@/lib/api-client";
import type { StockTransferDto, TransfersSummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory`;

export interface TransferPageParams { page?: number; pageSize?: number; status?: string; search?: string; }

export interface TransfersPage {
  items: StockTransferDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CreateTransferItem {
  stockItemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export interface CreateTransferPayload {
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  requestedBy: string;
  expectedDate: string;
  notes?: string | null;
  items: CreateTransferItem[];
}

export const transfersApi = {
  getAll: (p: TransferPageParams = {}): Promise<TransfersPage> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/transfers?${qs}`);
  },
  getSummary:  (): Promise<TransfersSummaryDto>    => rawApiClient.get(`${BASE}/transfers/summary`),
  getById:     (id: string): Promise<StockTransferDto> => rawApiClient.get(`${BASE}/transfers/${id}`),

  create: (payload: CreateTransferPayload): Promise<StockTransferDto> =>
    rawApiClient.post(`${BASE}/transfers`, payload),

  submit:  (id: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/submit`),
  approve: (id: string, by: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/approve`, { by }),
  receive: (id: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/receive`),
};
