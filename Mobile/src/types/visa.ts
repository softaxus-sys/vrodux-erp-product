import type { Tone } from "@/theme";

/**
 * Visa Services -- case management for a UAE visa consultancy. Mirrors
 * FrontendVite/src/lib/visa/visa.api.ts's status machine and DTOs exactly (same status strings,
 * same legal-transition map) so mobile can never offer a move the backend would reject.
 * Case creation (visa type + fee prefill + a dynamic applicant/dependent list) and the
 * government-channel connection screen (encrypted credentials, setup guides) are both
 * desktop-appropriate -- out of scope here, same call as Sales/Purchase order creation.
 */

export type VisaCaseStatus =
  | "draft"
  | "docs_pending"
  | "docs_complete"
  | "submitted"
  | "in_review"
  | "rfi_required"
  | "approved"
  | "issued"
  | "rejected"
  | "cancelled"
  | "closed";

export const CASE_STATUS_LABELS: Record<VisaCaseStatus, string> = {
  draft: "Draft",
  docs_pending: "Docs Pending",
  docs_complete: "Docs Complete",
  submitted: "Submitted",
  in_review: "In Review",
  rfi_required: "RFI Required",
  approved: "Approved",
  issued: "Issued",
  rejected: "Rejected",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const CASE_STATUS_TONE: Record<VisaCaseStatus, Tone> = {
  draft: "neutral",
  docs_pending: "warning",
  docs_complete: "info",
  submitted: "primary",
  in_review: "info",
  rfi_required: "warning",
  approved: "success",
  issued: "success",
  rejected: "destructive",
  cancelled: "neutral",
  closed: "neutral",
};

/** Mirrors `VisaCase.Transitions` on the backend exactly, via the web client's own copy of it --
 *  the UI must only ever offer a move the status machine will actually accept. */
export const CASE_TRANSITIONS: Record<VisaCaseStatus, VisaCaseStatus[]> = {
  draft: ["docs_pending", "cancelled"],
  docs_pending: ["docs_complete", "cancelled"],
  docs_complete: ["submitted", "docs_pending", "cancelled"],
  submitted: ["in_review", "rfi_required", "rejected", "cancelled"],
  in_review: ["approved", "rfi_required", "rejected"],
  rfi_required: ["docs_pending", "submitted", "cancelled"],
  approved: ["issued"],
  issued: ["closed"],
  rejected: ["docs_pending", "closed"],
  cancelled: [],
  closed: [],
};

export type CaseDocumentStatus = "pending" | "received" | "verified" | "rejected" | "expired";

export const DOCUMENT_STATUSES: CaseDocumentStatus[] = ["pending", "received", "verified", "rejected", "expired"];

export const DOCUMENT_STATUS_LABELS: Record<CaseDocumentStatus, string> = {
  pending: "Pending",
  received: "Received",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

export const DOCUMENT_STATUS_TONE: Record<CaseDocumentStatus, Tone> = {
  pending: "neutral",
  received: "info",
  verified: "success",
  rejected: "destructive",
  expired: "warning",
};

export interface ApplicantDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string | null;
  dateOfBirth: string | null;
  emiratesId: string | null;
  uidNumber: string | null;
  relationship: string;
}

export interface CaseDocumentDto {
  id: string;
  applicantId: string | null;
  name: string;
  status: string;
  fileUrl: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CaseStatusEventDto {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  byName: string;
  createdAt: string;
}

export interface VisaCaseSummaryDto {
  id: string;
  caseNumber: string;
  visaTypeId: string;
  visaTypeName: string;
  channel: string;
  emirate: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  priority: string;
  assignedTo: string;
  serviceFee: number;
  govtFee: number;
  govtReference: string | null;
  slaDueDate: string | null;
  primaryApplicantName: string;
  applicantCount: number;
  documentsPending: number;
  documentsTotal: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface VisaCaseDetailDto {
  id: string;
  caseNumber: string;
  visaTypeId: string;
  visaTypeName: string;
  channel: string;
  emirate: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  priority: string;
  assignedTo: string;
  serviceFee: number;
  govtFee: number;
  govtReference: string | null;
  slaDueDate: string | null;
  visaExpiryDate: string | null;
  rejectionReason: string | null;
  notes: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  applicants: ApplicantDto[];
  documents: CaseDocumentDto[];
  timeline: CaseStatusEventDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface VisaCasesSummaryDto {
  total: number;
  open: number;
  docsPending: number;
  submitted: number;
  approvedThisMonth: number;
  rejected: number;
  openServiceFees: number;
  openGovtFees: number;
}

export interface VisaCountItem {
  key: string;
  count: number;
}

export interface VisaRevenueItem {
  key: string;
  serviceFees: number;
  govtFees: number;
}

export interface VisaWorkloadItem {
  assignedTo: string;
  openCount: number;
}

export interface VisaDashboardDto {
  totalCases: number;
  openCases: number;
  overdueCases: number;
  dueThisWeek: number;
  openServiceFees: number;
  openGovtFees: number;
  expiringDocuments30: number;
  expiringPassports90: number;
  expiringVisas90: number;
  byStatus: VisaCountItem[];
  byType: VisaCountItem[];
  revenueByType: VisaRevenueItem[];
  workload: VisaWorkloadItem[];
}

export type RenewalKind = "visa" | "passport" | "document";

export const RENEWAL_KIND_LABELS: Record<RenewalKind, string> = {
  visa: "Visa Expiry",
  passport: "Passport Expiry",
  document: "Document Expiry",
};

export interface RenewalItemDto {
  kind: RenewalKind;
  caseId: string;
  caseNumber: string;
  visaTypeName: string;
  subject: string;
  expiryDate: string | null;
  daysLeft: number;
  caseStatus: string;
  assignedTo: string;
}
