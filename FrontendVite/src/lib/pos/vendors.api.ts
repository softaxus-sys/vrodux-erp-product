import { apiClient, type PagedResult } from "@/lib/api-client";
import type { VendorDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/vendors`;

export interface GetVendorsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
}

export interface UpsertVendorPayload {
  name: string;
  code?: string | null;
  category?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  notes?: string | null;
  status?: string | null;
  rating?: number | null;
}

export const vendorsApi = {
  getAll: (params: GetVendorsParams = {}): Promise<PagedResult<VendorDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.status)   qs.set("status",   params.status);
    if (params.category) qs.set("category", params.category);
    return apiClient.get<PagedResult<VendorDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<VendorDto> =>
    apiClient.get<VendorDto>(`${BASE}/${id}`),

  create: (payload: UpsertVendorPayload): Promise<{ id: string }> =>
    apiClient.post<{ id: string }>(BASE, payload),

  update: (id: string, payload: UpsertVendorPayload): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
