import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/tax`;

// ── Tax Periods ───────────────────────────────────────────────────────────────

export interface TaxPeriodDto {
  id: string;
  period: string;
  from: string;
  to: string;
  dueDate: string;
  status: string;
  outputVat: number;
  inputVat: number;
  netVat: number;
  filedDate: string | null;
  paidDate: string | null;
  penalty: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TaxTransactionDto {
  id: string;
  periodId: string;
  period: string;
  date: string;
  description: string;
  reference: string | null;
  type: string;
  amount: number;
  vatAmount: number;
  vatRate: number;
  createdAt: string;
}

export interface TaxSummaryDto {
  currentPeriodOutput: number;
  currentPeriodInput: number;
  currentNetVat: number;
  ytdVatPaid: number;
  nextDueDate: string | null;
}

export interface CreateTaxPeriodRequest {
  period: string;
  from: string;
  to: string;
  dueDate: string;
}

export const taxApi = {
  getPeriods: (): Promise<TaxPeriodDto[]> =>
    rawApiClient.get<TaxPeriodDto[]>(`${BASE}/periods`),

  getPeriodById: (id: string): Promise<TaxPeriodDto> =>
    rawApiClient.get<TaxPeriodDto>(`${BASE}/periods/${id}`),

  createPeriod: (data: CreateTaxPeriodRequest): Promise<TaxPeriodDto> =>
    rawApiClient.post<TaxPeriodDto>(`${BASE}/periods`, data),

  filePeriod: (id: string): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/periods/${id}/file`, {}),

  payPeriod: (id: string): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/periods/${id}/pay`, {}),

  getSummary: (): Promise<TaxSummaryDto> =>
    rawApiClient.get<TaxSummaryDto>(`${BASE}/summary`),

  getTransactions: (periodId?: string): Promise<TaxTransactionDto[]> => {
    const qs = periodId ? `?periodId=${periodId}` : "";
    return rawApiClient.get<TaxTransactionDto[]>(`${BASE}/transactions${qs}`);
  },
};
