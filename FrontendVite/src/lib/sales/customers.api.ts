import { rawApiClient } from "@/lib/api-client";
import type { SalesCustomerDto, UpsertCustomerRequest } from "./types";
import { getApiBaseUrl } from "@/lib/desktop";
// Re-exported so callers can import the request shape from the module whose functions take it,
// rather than having to know it lives in ./types.
export type { UpsertCustomerRequest };

const BASE = `${getApiBaseUrl()}/api/sales/customers`;

export const salesCustomersApi = {
  getAll: (params?: { search?: string; isActive?: boolean }): Promise<SalesCustomerDto[]> => {
    const qs = new URLSearchParams();
    if (params?.search)                     qs.set("search",   params.search);
    if (params?.isActive !== undefined)     qs.set("isActive", String(params.isActive));
    return rawApiClient.get<SalesCustomerDto[]>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<SalesCustomerDto> =>
    rawApiClient.get<SalesCustomerDto>(`${BASE}/${id}`),

  create: (payload: UpsertCustomerRequest): Promise<SalesCustomerDto> =>
    rawApiClient.post<SalesCustomerDto>(BASE, payload),

  update: (id: string, payload: UpsertCustomerRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
