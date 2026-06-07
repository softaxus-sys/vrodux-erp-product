import { rawApiClient } from "@/lib/api-client";
import type { StockTransferDto, TransfersSummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory`;

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
  getAll:      (): Promise<StockTransferDto[]>     => rawApiClient.get(`${BASE}/transfers`),
  getSummary:  (): Promise<TransfersSummaryDto>    => rawApiClient.get(`${BASE}/transfers/summary`),
  getById:     (id: string): Promise<StockTransferDto> => rawApiClient.get(`${BASE}/transfers/${id}`),

  create: (payload: CreateTransferPayload): Promise<StockTransferDto> =>
    rawApiClient.post(`${BASE}/transfers`, payload),

  submit:  (id: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/submit`),
  approve: (id: string, by: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/approve`, { by }),
  receive: (id: string): Promise<void> => rawApiClient.post(`${BASE}/transfers/${id}/receive`),
};
