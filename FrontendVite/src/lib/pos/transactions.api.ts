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

export interface HourlySalesDto { hour: number; sales: number; transactions: number; }
export interface PaymentMethodCountDto { method: string; count: number; }
export interface PosDashboardDto {
  hourly: HourlySalesDto[];
  methods: PaymentMethodCountDto[];
  totalSales: number;
  totalTransactions: number;
}

export const transactionsApi = {
  /**
   * Today's takings by hour and the payment-method split, aggregated in SQL.
   * The local date and UTC offset are sent by the caller because "today" at a till means the
   * terminal's day — deriving it from UTC would roll the day over mid-evening in the Gulf.
   */
  getDashboard: (): Promise<PosDashboardDto> => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // getTimezoneOffset is minutes to ADD to local to get UTC, so negate it.
    const utcOffsetMinutes = -now.getTimezoneOffset();
    return rawApiClient.get(`${BASE}/dashboard?date=${date}&utcOffsetMinutes=${utcOffsetMinutes}`);
  },

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
