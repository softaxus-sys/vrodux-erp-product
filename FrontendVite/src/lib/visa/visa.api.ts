import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/visa`;

// ── Types ───────────────────────────────────────────────────────────────────

export type VisaCaseStatus =
  | "draft" | "docs_pending" | "docs_complete" | "submitted" | "in_review"
  | "rfi_required" | "approved" | "issued" | "rejected" | "cancelled" | "closed";

export type CaseDocumentStatus = "pending" | "received" | "verified" | "rejected" | "expired";

export const CASE_STATUS_META: Record<VisaCaseStatus, { label: string; color: string; bg: string }> = {
  draft:         { label: "Draft",          color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  docs_pending:  { label: "Docs Pending",   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  docs_complete: { label: "Docs Complete",  color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  submitted:     { label: "Submitted",      color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  in_review:     { label: "In Review",      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  rfi_required:  { label: "RFI Required",   color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  approved:      { label: "Approved",       color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  issued:        { label: "Issued",         color: "text-success",     bg: "bg-success/10" },
  rejected:      { label: "Rejected",       color: "text-destructive", bg: "bg-destructive/10" },
  cancelled:     { label: "Cancelled",      color: "text-muted-foreground", bg: "bg-muted" },
  closed:        { label: "Closed",         color: "text-muted-foreground", bg: "bg-muted" },
};

/** Kanban columns — the active working pipeline (terminal states shown via filters). */
export const CASE_BOARD_COLUMNS: VisaCaseStatus[] =
  ["docs_pending", "docs_complete", "submitted", "in_review", "approved", "issued"];

/** Mirrors VisaCase.Transitions on the backend so the UI only offers legal moves. */
export const CASE_TRANSITIONS: Record<VisaCaseStatus, VisaCaseStatus[]> = {
  draft:         ["docs_pending", "cancelled"],
  docs_pending:  ["docs_complete", "cancelled"],
  docs_complete: ["submitted", "docs_pending", "cancelled"],
  submitted:     ["in_review", "rfi_required", "rejected", "cancelled"],
  in_review:     ["approved", "rfi_required", "rejected"],
  rfi_required:  ["docs_pending", "submitted", "cancelled"],
  approved:      ["issued"],
  issued:        ["closed"],
  rejected:      ["docs_pending", "closed"],
  cancelled:     [],
  closed:        [],
};

export interface VisaTypeDto {
  id: string; code: string; name: string; category: string; channel: string;
  defaultGovtFee: number; defaultServiceFee: number; processingDays: number;
  requiredDocuments: string[];
}

export interface UpsertVisaTypeRequest {
  name: string; category: string; channel: string;
  defaultGovtFee: number; defaultServiceFee: number; processingDays: number;
  requiredDocuments: string[];
}

export const VISA_CATEGORIES = ["employment", "family", "visit", "golden", "student", "freelance", "other"];
export const VISA_CHANNELS = ["manual", "gdrfa", "icp", "mohre"];

export interface ChannelDto {
  key: string; name: string; description: string; requiresCredentials: boolean;
  status: "active" | "beta" | "coming_soon"; setupGuide: string;
  connected: boolean; establishmentCard?: string | null; accountRef?: string | null;
  hasSecret: boolean; connectedAt?: string | null;
}
export interface GovtSubmissionDto {
  id: string; visaCaseId: string; channel: string; submissionType: string;
  externalReference?: string | null; status: string; notes?: string | null;
  submittedAt: string; updatedAt?: string | null;
}
export const SUBMISSION_TYPES = ["entry_permit", "status_change", "emirates_id", "stamping", "medical", "other"];
export const SUBMISSION_STATUSES = ["submitted", "in_review", "approved", "rejected", "completed"];

export interface ApplicantDto {
  id: string; firstName: string; lastName: string; fullName: string; nationality: string;
  passportNumber: string; passportExpiry?: string | null; dateOfBirth?: string | null;
  emiratesId?: string | null; uidNumber?: string | null; relationship: string;
}

export interface CaseDocumentDto {
  id: string; applicantId?: string | null; name: string; status: CaseDocumentStatus;
  fileUrl?: string | null; expiryDate?: string | null; notes?: string | null;
  createdAt: string; updatedAt?: string | null;
}

export interface CaseStatusEventDto {
  id: string; eventType: string; fromStatus?: string | null; toStatus?: string | null;
  note?: string | null; byName: string; createdAt: string;
}

export interface VisaCaseSummaryDto {
  id: string; caseNumber: string; visaTypeId: string; visaTypeName: string; channel: string;
  emirate: string; customerId?: string | null; customerName?: string | null;
  status: VisaCaseStatus; priority: string; assignedTo: string;
  serviceFee: number; govtFee: number; govtReference?: string | null;
  slaDueDate?: string | null; primaryApplicantName: string; applicantCount: number;
  documentsPending: number; documentsTotal: number;
  invoiceId?: string | null; invoiceNumber?: string | null;
  createdAt: string; updatedAt?: string | null;
}

export interface VisaCaseDetailDto extends Omit<VisaCaseSummaryDto,
  "primaryApplicantName" | "applicantCount" | "documentsPending" | "documentsTotal"> {
  visaExpiryDate?: string | null; rejectionReason?: string | null; notes?: string | null;
  applicants: ApplicantDto[]; documents: CaseDocumentDto[]; timeline: CaseStatusEventDto[];
}

export interface VisaCasesSummaryDto {
  total: number; open: number; docsPending: number; submitted: number;
  approvedThisMonth: number; rejected: number; openServiceFees: number; openGovtFees: number;
}

export interface ApplicantInput {
  firstName: string; lastName: string; nationality: string; passportNumber: string;
  passportExpiry?: string | null; dateOfBirth?: string | null;
  emiratesId?: string | null; uidNumber?: string | null; relationship: string;
}

export interface VisaCountItem { key: string; count: number; }
export interface VisaRevenueItem { key: string; serviceFees: number; govtFees: number; }
export interface VisaWorkloadItem { assignedTo: string; openCount: number; }

export interface VisaDashboardDto {
  totalCases: number; openCases: number; overdueCases: number; dueThisWeek: number;
  openServiceFees: number; openGovtFees: number;
  expiringDocuments30: number; expiringPassports90: number; expiringVisas90: number;
  byStatus: VisaCountItem[]; byType: VisaCountItem[];
  revenueByType: VisaRevenueItem[]; workload: VisaWorkloadItem[];
}

export interface RenewalItemDto {
  kind: "visa" | "passport" | "document"; caseId: string; caseNumber: string; visaTypeName: string;
  subject: string; expiryDate?: string | null; daysLeft: number; caseStatus: VisaCaseStatus; assignedTo: string;
}

export interface CreateVisaCaseRequest {
  visaTypeId: string; emirate?: string; customerName?: string | null; customerId?: string | null;
  priority?: string; assignedTo?: string; serviceFee?: number | null; govtFee?: number | null;
  slaDueDate?: string | null; notes?: string | null; applicants: ApplicantInput[];
  createdByName?: string;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const visaApi = {
  getTypes:   (): Promise<VisaTypeDto[]> => rawApiClient.get(`${BASE}/types`),
  createType: (body: UpsertVisaTypeRequest): Promise<VisaTypeDto> => rawApiClient.post(`${BASE}/types`, body),
  updateType: (id: string, body: UpsertVisaTypeRequest): Promise<void> => rawApiClient.put(`${BASE}/types/${id}`, body),
  deleteType: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/types/${id}`),
  getSummary: (): Promise<VisaCasesSummaryDto> => rawApiClient.get(`${BASE}/cases/summary`),
  getDashboard: (): Promise<VisaDashboardDto> => rawApiClient.get(`${BASE}/cases/dashboard`),
  getRenewals: (withinDays?: number): Promise<RenewalItemDto[]> =>
    rawApiClient.get(`${BASE}/cases/renewals${withinDays ? `?withinDays=${withinDays}` : ""}`),
  getCases:   (params?: { status?: string; customerId?: string }): Promise<VisaCaseSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.customerId) qs.set("customerId", params.customerId);
    const q = qs.toString();
    return rawApiClient.get(`${BASE}/cases${q ? `?${q}` : ""}`);
  },
  getCase:    (id: string): Promise<VisaCaseDetailDto> => rawApiClient.get(`${BASE}/cases/${id}`),
  createCase: (body: CreateVisaCaseRequest): Promise<VisaCaseDetailDto> =>
    rawApiClient.post(`${BASE}/cases`, body),
  changeStatus: (id: string, body: { status: string; govtReference?: string | null; rejectionReason?: string | null; visaExpiryDate?: string | null; note?: string | null; byName?: string }): Promise<void> =>
    rawApiClient.patch(`${BASE}/cases/${id}/status`, body),
  assign:     (id: string, assignedTo: string, byName?: string): Promise<void> =>
    rawApiClient.patch(`${BASE}/cases/${id}/assign`, { assignedTo, byName }),
  updateDocument: (caseId: string, documentId: string, body: { status: string; fileUrl?: string | null; expiryDate?: string | null; notes?: string | null; byName?: string }): Promise<void> =>
    rawApiClient.put(`${BASE}/cases/${caseId}/documents/${documentId}`, body),
  addDocument: (caseId: string, body: { applicantId?: string | null; name: string; byName?: string }): Promise<CaseDocumentDto> =>
    rawApiClient.post(`${BASE}/cases/${caseId}/documents`, body),
  addNote:    (caseId: string, note: string, byName?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/cases/${caseId}/notes`, { note, byName }),
  linkInvoice: (caseId: string, body: { invoiceId: string; invoiceNumber?: string | null; byName?: string }): Promise<void> =>
    rawApiClient.patch(`${BASE}/cases/${caseId}/invoice`, body),
  deleteCase: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/cases/${id}`),

  // Channels
  getChannels:      (): Promise<ChannelDto[]> => rawApiClient.get(`${BASE}/channels`),
  connectChannel:   (channel: string, body: { establishmentCard?: string | null; accountRef?: string | null; secret?: string | null }): Promise<void> =>
    rawApiClient.post(`${BASE}/channels/${channel}/connect`, body),
  disconnectChannel:(channel: string): Promise<void> => rawApiClient.post(`${BASE}/channels/${channel}/disconnect`, {}),

  // Government submissions (per case)
  getSubmissions:   (caseId: string): Promise<GovtSubmissionDto[]> => rawApiClient.get(`${BASE}/cases/${caseId}/submissions`),
  createSubmission: (caseId: string, body: { channel: string; submissionType: string; externalReference?: string | null; notes?: string | null }): Promise<GovtSubmissionDto> =>
    rawApiClient.post(`${BASE}/cases/${caseId}/submissions`, body),
  updateSubmission: (caseId: string, submissionId: string, body: { status: string; externalReference?: string | null; notes?: string | null }): Promise<void> =>
    rawApiClient.put(`${BASE}/cases/${caseId}/submissions/${submissionId}`, body),
};
