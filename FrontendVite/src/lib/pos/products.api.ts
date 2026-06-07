import { apiClient, type PagedResult } from "@/lib/api-client";
import type { ProductDto, ProductSummaryDto, StockMovementDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/products`;

export interface GetProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  isLowStock?: boolean;
}

export const productsApi = {
  getAll: (params: GetProductsParams = {}): Promise<PagedResult<ProductSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.search)     qs.set("search",     params.search);
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    if (params.isActive !== undefined) qs.set("isActive", String(params.isActive));
    if (params.isLowStock) qs.set("isLowStock", "true");
    return apiClient.get<PagedResult<ProductSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<ProductDto> =>
    apiClient.get<ProductDto>(`${BASE}/${id}`),

  getByBarcode: (barcode: string): Promise<ProductDto> =>
    apiClient.get<ProductDto>(`${BASE}/barcode/${encodeURIComponent(barcode)}`),

  create: (payload: {
    name: string;
    description?: string | null;
    sku?: string | null;
    barcode?: string | null;
    categoryId: string;
    salePrice: number;
    costPrice: number;
    taxRate: number;
    unit: string;
    initialStock?: number;
    reorderLevel?: number;
    trackInventory?: boolean;
    imageUrl?: string | null;
  }): Promise<ProductDto> => apiClient.post<ProductDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      description?: string | null;
      sku?: string | null;
      barcode?: string | null;
      categoryId: string;
      salePrice: number;
      costPrice: number;
      taxRate: number;
      unit: string;
      reorderLevel?: number;
      trackInventory?: boolean;
      isActive?: boolean;
      imageUrl?: string | null;
    }
  ): Promise<ProductDto> => apiClient.put<ProductDto>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),

  adjustStock: (
    id: string,
    quantity: number,
    adjustmentType: string,
    notes?: string
  ): Promise<StockMovementDto> =>
    apiClient.post<StockMovementDto>(`${BASE}/${id}/stock-adjustment`, {
      quantity,
      adjustmentType,
      notes,
    }),
};
