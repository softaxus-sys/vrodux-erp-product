import { apiClient, type PagedResult } from "@/lib/api-client";
import type { StockMovementDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory/stock-movements`;

export interface GetInventoryMovementsParams {
  page?: number;
  pageSize?: number;
  productId?: string;
  movementType?: string;
  from?: string;
  to?: string;
  warehouseId?: string;
}

export interface CreateMovementPayload {
  productId: string;
  movementType: string;     // Receipt | Sale | Adjustment | Transfer | WriteOff | Return
  quantity: number;         // SIGNED for Adjustment (negative = decrease)
  unitCost: number;
  reference?: string | null;
  notes?: string | null;
  warehouseId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;   // ISO date (yyyy-MM-dd)
}

export const inventoryMovementsApi = {
  getAll: (params: GetInventoryMovementsParams = {}): Promise<PagedResult<StockMovementDto>> => {
    const qs = new URLSearchParams();
    if (params.page)         qs.set("page",         String(params.page));
    if (params.pageSize)     qs.set("pageSize",     String(params.pageSize));
    if (params.productId)    qs.set("productId",    params.productId);
    if (params.movementType) qs.set("movementType", params.movementType);
    if (params.from)         qs.set("from",         params.from);
    if (params.to)           qs.set("to",           params.to);
    if (params.warehouseId)  qs.set("warehouseId",  params.warehouseId);
    return apiClient.get<PagedResult<StockMovementDto>>(`${BASE}?${qs}`);
  },

  create: (payload: CreateMovementPayload): Promise<{ id: string }> =>
    apiClient.post<{ id: string }>(BASE, payload),
};
