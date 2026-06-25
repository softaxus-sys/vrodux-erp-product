import { apiClient, type PagedResult } from "@/lib/api-client";
import type { ProductCategoryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/categories`;

export const categoriesApi = {
  getAll: (params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PagedResult<ProductCategoryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize ?? 200));
    if (params.search)   qs.set("search",   params.search);
    return apiClient.get<PagedResult<ProductCategoryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<ProductCategoryDto> =>
    apiClient.get<ProductCategoryDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    description?: string | null;
    parentCategoryId?: string | null;
    sortOrder?: number;
  }): Promise<ProductCategoryDto> => apiClient.post<ProductCategoryDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      description?: string | null;
      parentCategoryId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<ProductCategoryDto> =>
    apiClient.put<ProductCategoryDto>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
