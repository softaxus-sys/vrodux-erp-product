import { apiClient } from "@/lib/api-client";
import type { ProductCategoryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory/categories`;

export const inventoryCategoriesApi = {
  getAll: (params: { search?: string; isActive?: boolean } = {}): Promise<ProductCategoryDto[]> => {
    const qs = new URLSearchParams();
    if (params.search)              qs.set("search",   params.search);
    if (params.isActive !== undefined) qs.set("isActive", String(params.isActive));
    return apiClient.get<ProductCategoryDto[]>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<ProductCategoryDto> =>
    apiClient.get<ProductCategoryDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    code?: string | null;
    description?: string | null;
    parentId?: string | null;
  }): Promise<ProductCategoryDto> =>
    apiClient.post<ProductCategoryDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      code?: string | null;
      description?: string | null;
      parentId?: string | null;
      isActive: boolean;
    }
  ): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
