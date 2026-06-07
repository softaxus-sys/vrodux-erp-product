import { apiClient, type PagedResult } from "@/lib/api-client";
import type { CustomerDto, CustomerSummaryDto } from "./types";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/customers`;

export const customersApi = {
  getAll: (params: {
    page?: number;
    pageSize?: number;
    search?: string;
  } = {}): Promise<PagedResult<CustomerSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    return apiClient.get<PagedResult<CustomerSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<CustomerDto> =>
    apiClient.get<CustomerDto>(`${BASE}/${id}`),

  create: (payload: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
  }): Promise<CustomerDto> => apiClient.post<CustomerDto>(BASE, payload),

  update: (
    id: string,
    payload: {
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
    }
  ): Promise<CustomerDto> => apiClient.put<CustomerDto>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
