import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/purchase`;

export type ApprovalStatus   = "pending" | "approved" | "rejected" | "cancelled";
export type PurchaseOrderType = "purchase_order" | "purchase_requisition" | "vendor_quote";

export interface ApprovalItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ApprovalDto {
  id: string;
  referenceNumber: string;
  type: PurchaseOrderType;
  status: ApprovalStatus;
  requestedBy: string;
  requestDate: string;
  approvedBy: string | null;
  approvedDate: string | null;
  vendorId: string | null;
  vendorName: string | null;
  description: string;
  totalAmount: number;
  currency: string;
  items: ApprovalItemDto[];
  notes: string;
  urgency: "low" | "medium" | "high" | "critical";
}

export interface ApprovalSummaryDto {
  pending: number;
  approved: number;
  rejected: number;
  totalValuePending: number;
  avgApprovalTimeDays: number;
}

export const approvalsApi = {
  getAll: (params?: { status?: string; type?: string }): Promise<ApprovalDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type)   qs.set("type",   params.type);
    const query = qs.toString();
    return rawApiClient.get<ApprovalDto[]>(`${BASE}/approvals${query ? "?" + query : ""}`);
  },

  getById: (id: string): Promise<ApprovalDto> =>
    rawApiClient.get<ApprovalDto>(`${BASE}/approvals/${id}`),

  approve: (id: string, notes?: string): Promise<ApprovalDto> =>
    rawApiClient.put<ApprovalDto>(`${BASE}/approvals/${id}/approve`, { notes }),

  reject: (id: string, reason: string): Promise<ApprovalDto> =>
    rawApiClient.put<ApprovalDto>(`${BASE}/approvals/${id}/reject`, { reason }),

  getSummary: (): Promise<ApprovalSummaryDto> =>
    rawApiClient.get<ApprovalSummaryDto>(`${BASE}/approvals/summary`),
};
