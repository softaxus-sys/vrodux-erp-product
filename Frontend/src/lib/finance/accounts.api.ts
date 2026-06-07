import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/accounts`;

export interface AccountDto {
  id: string;
  accountNumber: string;
  name: string;
  accountType: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  balance: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertAccountRequest {
  accountNumber: string;
  name: string;
  accountType: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export const accountsApi = {
  getAll: (params?: { search?: string; accountType?: string; isActive?: boolean }): Promise<AccountDto[]> => {
    const qs = new URLSearchParams();
    if (params?.search)              qs.set("search",      params.search);
    if (params?.accountType)         qs.set("accountType", params.accountType);
    if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
    const q = qs.toString();
    return rawApiClient.get<AccountDto[]>(q ? `${BASE}?${q}` : BASE);
  },

  getById: (id: string): Promise<AccountDto> =>
    rawApiClient.get<AccountDto>(`${BASE}/${id}`),

  create: (data: UpsertAccountRequest): Promise<AccountDto> =>
    rawApiClient.post<AccountDto>(BASE, data),

  update: (id: string, data: UpsertAccountRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
