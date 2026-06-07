import { apiClient, type PagedResult } from "@/lib/api-client";
import type { ProductDto, ProductSummaryDto } from "./types";

const BASE = `${process.env.NEXT_PUBLIC_INVENTORY_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5002"}/api/inventory/products`;

export interface GetProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  isLowStock?: boolean;
}

export const inventoryProductsApi = {
  getAll: (params: GetProductsParams = {}): Promise<PagedResult<ProductSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)                    qs.set("page",       String(params.page));
    if (params.pageSize)                qs.set("pageSize",   String(params.pageSize));
    if (params.search)                  qs.set("search",     params.search);
    if (params.categoryId)              qs.set("categoryId", params.categoryId);
    if (params.isActive !== undefined)  qs.set("isActive",   String(params.isActive));
    if (params.isLowStock !== undefined) qs.set("isLowStock", String(params.isLowStock));
    return apiClient.get<PagedResult<ProductSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<ProductDto> =>
    apiClient.get<ProductDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    description?: string | null;
    sku?: string | null;
    barcode?: string | null;
    categoryId: string;
    brandId?: string | null;
    unitOfMeasureId?: string | null;
    salePrice: number;
    costPrice: number;
    taxRate?: number;
    unit: string;
    openingStock?: number;
    reorderLevel?: number;
    trackInventory?: boolean;
    imageUrl?: string | null;
  }): Promise<ProductDto> =>
    apiClient.post<ProductDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      description?: string | null;
      sku?: string | null;
      barcode?: string | null;
      categoryId: string;
      brandId?: string | null;
      unitOfMeasureId?: string | null;
      salePrice: number;
      costPrice: number;
      taxRate?: number;
      unit: string;
      reorderLevel?: number;
      trackInventory?: boolean;
      imageUrl?: string | null;
    }
  ): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  activate:   (id: string): Promise<void> => apiClient.post<void>(`${BASE}/${id}/activate`, {}),
  deactivate: (id: string): Promise<void> => apiClient.post<void>(`${BASE}/${id}/deactivate`, {}),
  delete:     (id: string): Promise<void> => apiClient.delete<void>(`${BASE}/${id}`),
};
