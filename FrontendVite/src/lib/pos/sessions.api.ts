import { apiClient, type PagedResult } from "@/lib/api-client";
import type { POSSessionDto, POSSessionSummaryDto, POSTransactionSummaryDto, CashMovementDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sessions`;

export const sessionsApi = {
  getActive: (): Promise<POSSessionSummaryDto[]> =>
    apiClient.get<POSSessionSummaryDto[]>(`${BASE}/active`),

  getById: (id: string): Promise<POSSessionDto> =>
    apiClient.get<POSSessionDto>(`${BASE}/${id}`),

  getTransactions: (
    sessionId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<PagedResult<POSTransactionSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    return apiClient.get<PagedResult<POSTransactionSummaryDto>>(
      `${BASE}/${sessionId}/transactions?${qs}`
    );
  },

  open: (payload: {
    registerId: string;
    openingCash: number;
    notes?: string | null;
  }): Promise<POSSessionDto> => apiClient.post<POSSessionDto>(`${BASE}/open`, payload),

  close: (
    sessionId: string,
    payload: { closingCash: number; notes?: string | null }
  ): Promise<POSSessionDto> =>
    apiClient.post<POSSessionDto>(`${BASE}/${sessionId}/close`, payload),

  suspend: (
    sessionId: string,
    payload?: { notes?: string | null }
  ): Promise<POSSessionDto> =>
    apiClient.post<POSSessionDto>(`${BASE}/${sessionId}/suspend`, payload ?? {}),

  recordCashMovement: (
    sessionId: string,
    payload: { type: "payin" | "payout"; amount: number; reason: string }
  ): Promise<CashMovementDto> =>
    apiClient.post<CashMovementDto>(`${BASE}/${sessionId}/cash-movement`, payload),

  getCashMovements: (sessionId: string): Promise<CashMovementDto[]> =>
    apiClient.get<CashMovementDto[]>(`${BASE}/${sessionId}/cash-movements`),
};
