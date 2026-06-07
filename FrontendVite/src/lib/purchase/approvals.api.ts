import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/purchase`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalStatus   = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalPriority = "low" | "medium" | "high" | "urgent";
export type ApprovalCategory =
  | "software" | "cloud" | "hardware" | "telecom"
  | "office_supplies" | "facilities" | "professional_services" | "logistics";

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
  currency: "AED" | "USD";
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
};

// ── API ───────────────────────────────────────────────────────────────────────

export const approvalsApi = {
  getAll:     (): Promise<PurchaseApprovalDto[]>   => rawApiClient(`${BASE}/approvals`),
  getSummary: (): Promise<ApprovalsSummaryDto>     => rawApiClient(`${BASE}/approvals/summary`),
  getById:    (id: string): Promise<PurchaseApprovalDto> => rawApiClient(`${BASE}/approvals/${id}`),
};
