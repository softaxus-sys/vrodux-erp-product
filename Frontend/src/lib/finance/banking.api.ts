import { rawApiClient } from "@/lib/api-client";
import type { PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance`;

// ── Bank Accounts ─────────────────────────────────────────────────────────────

export interface BankAccountDto {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  status: string;
  balance: number;
  availableBalance: number;
  currency: string;
  lastSynced: string | null;
  createdAt: string;
}

export interface CreateBankAccountRequest {
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  currency?: string;
  openingBalance?: number;
}

// ── Bank Transactions ─────────────────────────────────────────────────────────

export interface BankTransactionDto {
  id: string;
  accountId: string;
  date: string;
  description: string;
  category: string | null;
  reference: string | null;
  type: string;
  amount: number;
  balance: number;
  reconciled: boolean;
  createdAt: string;
}

export interface CreateTransactionRequest {
  accountId: string;
  date: string;
  description: string;
  category?: string | null;
  reference?: string | null;
  type: string;
  amount: number;
}

export const bankingApi = {
  // Accounts
  getAccounts: (): Promise<BankAccountDto[]> =>
    rawApiClient.get<BankAccountDto[]>(`${BASE}/bank-accounts`),

  getAccountById: (id: string): Promise<BankAccountDto> =>
    rawApiClient.get<BankAccountDto>(`${BASE}/bank-accounts/${id}`),

  createAccount: (data: CreateBankAccountRequest): Promise<BankAccountDto> =>
    rawApiClient.post<BankAccountDto>(`${BASE}/bank-accounts`, data),

  // Transactions
  getTransactions: (params?: {
    accountId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<BankTransactionDto>> => {
    const qs = new URLSearchParams();
    if (params?.accountId) qs.set("accountId", params.accountId);
    if (params?.page)      qs.set("page",      String(params.page));
    if (params?.pageSize)  qs.set("pageSize",  String(params.pageSize));
    const q = qs.toString();
    return rawApiClient.get<PagedResult<BankTransactionDto>>(
      q ? `${BASE}/bank-transactions?${q}` : `${BASE}/bank-transactions`
    );
  },

  createTransaction: (data: CreateTransactionRequest): Promise<BankTransactionDto> =>
    rawApiClient.post<BankTransactionDto>(`${BASE}/bank-transactions`, data),

  reconcileTransaction: (id: string): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/bank-transactions/${id}/reconcile`, {}),
};
