import { apiClient, type PagedResult } from "@/lib/api-client";
import type { WarehouseDto } from "./types";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/inventory/warehouses`;

export interface UpsertWarehouseRequest {
  name:          string;
  code?:         string | null;
  address?:      string | null;
  contactPerson?: string | null;
  phone?:        string | null;
  isActive?:     boolean;
}

export const warehousesApi = {
  getAll: (): Promise<WarehouseDto[]> =>
    apiClient.get(BASE),

  getById: (id: string): Promise<WarehouseDto> =>
    apiClient.get(`${BASE}/${id}`),

  create: (data: UpsertWarehouseRequest): Promise<WarehouseDto> =>
    apiClient.post(BASE, data),

  update: (id: string, data: UpsertWarehouseRequest): Promise<WarehouseDto> =>
    apiClient.put(`${BASE}/${id}`, data),

  setDefault: (id: string): Promise<void> =>
    apiClient.patch(`${BASE}/${id}/set-default`),

  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}`),
};
