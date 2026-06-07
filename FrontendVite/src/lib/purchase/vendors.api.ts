import { rawApiClient, type PagedResult } from "@/lib/api-client";
import type { VendorDto } from "@/lib/pos/types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase/vendors`;

export interface GetPurchaseVendorsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
}

export interface UpsertVendorRequest {
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
  status?: string;
  rating?: number;
}

export const purchaseVendorsApi = {
  getAll: (params: GetPurchaseVendorsParams = {}): Promise<PagedResult<VendorDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.status)   qs.set("status",   params.status);
    if (params.category) qs.set("category", params.category);
    return rawApiClient.get<PagedResult<VendorDto>>(`${BASE}?${qs}`);
  },

  getAll_unbounded: (): Promise<PagedResult<VendorDto>> =>
    rawApiClient.get<PagedResult<VendorDto>>(`${BASE}?pageSize=200`),

  getById: (id: string): Promise<VendorDto> =>
    rawApiClient.get<VendorDto>(`${BASE}/${id}`),

  create: (payload: UpsertVendorRequest): Promise<VendorDto> =>
    rawApiClient.post<VendorDto>(BASE, payload),

  update: (id: string, payload: UpsertVendorRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
