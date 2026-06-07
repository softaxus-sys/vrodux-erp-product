import { apiClient } from "@/lib/api-client";
import type { BrandDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory/brands`;

export const brandsApi = {
  getAll: (params: { search?: string; isActive?: boolean } = {}): Promise<BrandDto[]> => {
    const qs = new URLSearchParams();
    if (params.search)                 qs.set("search",   params.search);
    if (params.isActive !== undefined)  qs.set("isActive", String(params.isActive));
    return apiClient.get<BrandDto[]>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<BrandDto> =>
    apiClient.get<BrandDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    code?: string | null;
    description?: string | null;
    logoUrl?: string | null;
  }): Promise<BrandDto> =>
    apiClient.post<BrandDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      code?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      isActive: boolean;
    }
  ): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
