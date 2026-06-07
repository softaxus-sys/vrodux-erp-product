import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/returns`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReturnStatus  = "pending" | "approved" | "rejected" | "refunded" | "completed";
export type ReturnReason  = "defective" | "wrong_item" | "not_as_described" | "duplicate_order" | "changed_mind" | "other";

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
  totalRefundValue: number;
}

// ── API client ────────────────────────────────────────────────────────────────

export const returnsApi = {
  getAll:     (): Promise<SalesReturnDto[]>    => rawApiClient(`${BASE}`),
  getSummary: (): Promise<ReturnsSummaryDto>   => rawApiClient(`${BASE}/summary`),
  getById:    (id: string): Promise<SalesReturnDto> => rawApiClient(`${BASE}/${id}`),
};
