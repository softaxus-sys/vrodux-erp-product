import { apiClient, type PagedResult } from "@/lib/api-client";
import type { StockMovementDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/stock-movements`;

export interface GetStockMovementsParams {
  page?: number;
  pageSize?: number;
  productId?: string;
  type?: string;
  from?: string;
  to?: string;
}

export const stockMovementsApi = {
  getAll: (params: GetStockMovementsParams = {}): Promise<PagedResult<StockMovementDto>> => {
    const qs = new URLSearchParams();
    if (params.page)      qs.set("page",      String(params.page));
    if (params.pageSize)  qs.set("pageSize",  String(params.pageSize));
    if (params.productId) qs.set("productId", params.productId);
    if (params.type)      qs.set("type",      params.type);
    if (params.from)      qs.set("from",      params.from);
    if (params.to)        qs.set("to",        params.to);
    return apiClient.get<PagedResult<StockMovementDto>>(`${BASE}?${qs}`);
  },
};
