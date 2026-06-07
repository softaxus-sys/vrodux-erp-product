import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/sales`;

export type ReturnStatus = "pending" | "approved" | "rejected" | "refunded" | "completed";
export type ReturnReason = "defective" | "wrong_item" | "not_as_described" | "duplicate_order" | "changed_mind" | "other";

export interface ReturnItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesReturnDto {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  requestDate: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonDetail: string;
  items: ReturnItemDto[];
  refundAmount: number;
  currency: string;
  creditNote?: string;
  processedBy?: string;
  processedDate?: string;
  refundMethod?: "bank_transfer" | "credit_note" | "cash";
}

export interface ReturnsSummaryDto {
  total: number;
  pending: number;
  approved: number;
  refunded: number;
  totalRefundAmount: number;
  avgProcessingDays: number;
}

export const returnsApi = {
  getAll: (params?: { status?: string; reason?: string }): Promise<SalesReturnDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.reason) qs.set("reason", params.reason);
    const query = qs.toString();
    return rawApiClient.get<SalesReturnDto[]>(`${BASE}/returns${query ? "?" + query : ""}`);
  },

  getById: (id: string): Promise<SalesReturnDto> =>
    rawApiClient.get<SalesReturnDto>(`${BASE}/returns/${id}`),

  approve: (id: string, refundMethod: string): Promise<SalesReturnDto> =>
    rawApiClient.put<SalesReturnDto>(`${BASE}/returns/${id}/approve`, { refundMethod }),

  reject: (id: string, reason: string): Promise<SalesReturnDto> =>
    rawApiClient.put<SalesReturnDto>(`${BASE}/returns/${id}/reject`, { reason }),

  getSummary: (): Promise<ReturnsSummaryDto> =>
    rawApiClient.get<ReturnsSummaryDto>(`${BASE}/returns/summary`),
};
