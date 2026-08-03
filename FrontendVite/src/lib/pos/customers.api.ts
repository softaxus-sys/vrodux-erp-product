import { apiClient, type PagedResult } from "@/lib/api-client";
import type { CustomerDto, CustomerSummaryDto, CustomerWalletTransactionDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/customers`;

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

  getWalletTransactions: (id: string): Promise<CustomerWalletTransactionDto[]> =>
    apiClient.get<CustomerWalletTransactionDto[]>(`${BASE}/${id}/wallet-transactions`),

  topUpWallet: (id: string, amount: number, notes?: string | null): Promise<CustomerDto> =>
    apiClient.post<CustomerDto>(`${BASE}/${id}/wallet/topup`, { amount, notes }),

  setCreditLimit: (id: string, creditLimit: number): Promise<CustomerDto> =>
    apiClient.put<CustomerDto>(`${BASE}/${id}/credit-limit`, { creditLimit }),

  recordHouseAccountPayment: (id: string, amount: number, notes?: string | null): Promise<CustomerDto> =>
    apiClient.post<CustomerDto>(`${BASE}/${id}/house-account/payment`, { amount, notes }),
};
