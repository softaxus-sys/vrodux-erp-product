import { apiClient } from "@/lib/api-client";
import type { UnitOfMeasureDto } from "./types";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/inventory/units-of-measure`;

export const uomApi = {
  getAll: (params: { search?: string; isActive?: boolean } = {}): Promise<UnitOfMeasureDto[]> => {
    const qs = new URLSearchParams();
    if (params.search)                 qs.set("search",   params.search);
    if (params.isActive !== undefined)  qs.set("isActive", String(params.isActive));
    return apiClient.get<UnitOfMeasureDto[]>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<UnitOfMeasureDto> =>
    apiClient.get<UnitOfMeasureDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    symbol: string;
    description?: string | null;
  }): Promise<UnitOfMeasureDto> =>
    apiClient.post<UnitOfMeasureDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      symbol: string;
      description?: string | null;
      isActive: boolean;
    }
  ): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
