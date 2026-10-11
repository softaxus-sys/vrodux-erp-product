import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/purchase`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalStatus   = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalPriority = "low" | "medium" | "high" | "urgent";
export type ApprovalCategory =
  | "software" | "cloud" | "hardware" | "telecom"
  | "office_supplies" | "facilities" | "professional_services" | "logistics" | "raw_materials";

export interface ApprovalItemDto {
  id: string;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  total: number;
}

export interface PurchaseApprovalDto {
  id: string;
  requestNumber: string;
  title: string;
  requestedBy: string;
  department: string;
  requestDate: string;
  requiredBy: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  category: ApprovalCategory;
  vendorSuggestion?: string;
  items: ApprovalItemDto[];
  totalAmount: number;
  currency: string;
  justification: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  convertedToPO?: string;
}

export interface ApprovalsSummaryDto {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalRequestedValue: number;
}

export const CATEGORY_LABELS: Record<ApprovalCategory, string> = {
  software:              "Software",
  cloud:                 "Cloud Services",
  hardware:              "Hardware",
  telecom:               "Telecom",
  office_supplies:       "Office Supplies",
  facilities:            "Facilities",
  professional_services: "Professional Services",
  logistics:             "Logistics",
  raw_materials:         "Raw Materials",
};

// ── API ───────────────────────────────────────────────────────────────────────

export interface CreateApprovalRequest {
  title: string;
  requestedBy: string;
  department: string;
  requiredBy: string;
  priority: ApprovalPriority;
  category: ApprovalCategory;
  vendorSuggestion?: string | null;
  justification: string;
  currency: string;
  items: { description: string; quantity: number; estimatedUnitPrice: number }[];
}

export const approvalsApi = {
  create:     (body: CreateApprovalRequest): Promise<PurchaseApprovalDto> => rawApiClient.post(`${BASE}/approvals`, body),
  getAll:     (): Promise<PurchaseApprovalDto[]>   => rawApiClient.get(`${BASE}/approvals`),
  getSummary: (): Promise<ApprovalsSummaryDto>     => rawApiClient.get(`${BASE}/approvals/summary`),
  getById:    (id: string): Promise<PurchaseApprovalDto> => rawApiClient.get(`${BASE}/approvals/${id}`),
  approve:    (id: string, by: string): Promise<void> => rawApiClient.post(`${BASE}/approvals/${id}/approve`, { by }),
  reject:     (id: string, by: string, reason: string): Promise<void> => rawApiClient.post(`${BASE}/approvals/${id}/reject`, { by, reason }),
};
