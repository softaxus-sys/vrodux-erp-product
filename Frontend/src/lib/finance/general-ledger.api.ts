import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/general-ledger`;

export interface TrialBalanceLineDto {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface TrialBalanceDto {
  period: string;
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  lines: TrialBalanceLineDto[];
}

export interface GLSummaryDto {
  currentPeriod: string;
  availablePeriods: string[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  accountCount: number;
}

export const generalLedgerApi = {
  getSummary: (): Promise<GLSummaryDto> =>
    rawApiClient.get<GLSummaryDto>(`${BASE}/summary`),

  getTrialBalance: (period?: string): Promise<TrialBalanceDto> => {
    const qs = period ? `?period=${encodeURIComponent(period)}` : "";
    return rawApiClient.get<TrialBalanceDto>(`${BASE}/trial-balance${qs}`);
  },
};
