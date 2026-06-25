import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  POSTransactionDto,
  POSTransactionSummaryDto,
  HeldTransactionDto,
  CreateSaleRequest,
  RefundRequest,
  LineItemRequest,
  PaymentRequest,
} from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/transactions`;

export interface GetTransactionsParams {
  page?: number;
  pageSize?: number;
  sessionId?: string;
  cashierId?: string;
  customerId?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const transactionsApi = {
  getAll: (params: GetTransactionsParams = {}): Promise<PagedResult<POSTransactionSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.sessionId)  qs.set("sessionId",  params.sessionId);
    if (params.cashierId)  qs.set("cashierId",  params.cashierId);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.type)       qs.set("type",       params.type);
    if (params.status)     qs.set("status",     params.status);
    if (params.from)       qs.set("from",       params.from);
    if (params.to)         qs.set("to",         params.to);
    if (params.search)     qs.set("search",     params.search);
    return apiClient.get<PagedResult<POSTransactionSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<POSTransactionDto> =>
    apiClient.get<POSTransactionDto>(`${BASE}/${id}`),

  createSale: (payload: CreateSaleRequest): Promise<POSTransactionDto> =>
    apiClient.post<POSTransactionDto>(`${BASE}/sale`, payload),

  void: (
    transactionId: string,
    payload: { reason?: string | null }
  ): Promise<POSTransactionDto> =>
    apiClient.post<POSTransactionDto>(`${BASE}/${transactionId}/void`, payload),

  refund: (
    transactionId: string,
    payload: RefundRequest
  ): Promise<POSTransactionDto> =>
    apiClient.post<POSTransactionDto>(`${BASE}/${transactionId}/refund`, payload),

  hold: (payload: {
    sessionId: string;
    label: string;
    items: LineItemRequest[];
    customerId?: string | null;
  }): Promise<HeldTransactionDto> =>
    apiClient.post<HeldTransactionDto>(`${BASE}/hold`, payload),

  recall: (heldId: string): Promise<HeldTransactionDto> =>
    apiClient.post<HeldTransactionDto>(`${BASE}/held/${heldId}/recall`, {}),
};

export type { LineItemRequest, PaymentRequest, CreateSaleRequest, RefundRequest };
