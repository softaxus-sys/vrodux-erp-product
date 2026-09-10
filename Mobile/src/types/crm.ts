/**
 * Trimmed mirror of FrontendVite/src/lib/crm/crm.api.ts's DTOs -- only the
 * fields the mobile leads screens actually read. Keep in sync with the
 * backend CRM service, not re-derived locally.
 */
export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost";
export type LeadPriority = "low" | "medium" | "high";
export type PurchaseUrgency = "immediate" | "1_month" | "1_3_months" | "3_6_months" | "6_plus" | "unknown";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task";

export interface LeadDto {
  id: string;
  fullName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  whatsApp?: string | null;
  city: string;
  source: string;
  status: LeadStatus;
  priority: LeadPriority;
  score: number;
  estimatedValue: number;
  currency: "AED" | "USD" | "SAR";
  assignedTo: string;
  assignedToUserId?: string | null;
  createdDate: string;
  lastContactDate?: string | null;
  notes?: string | null;
  interestedIn?: string | null;
  budget?: string | null;
  message?: string | null;
  purchaseTimeframe?: string | null;
  purchaseUrgency?: PurchaseUrgency | null;
  convertedDealStage?: string | null;
}

export interface LeadsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /** A lead status, or "open" for everything still being worked. */
  status?: string;
  sortBy?: "date" | "score" | "value";
  sortDesc?: boolean;
}

export interface PagedLeads {
  items: LeadDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ActivityDto {
  id: string;
  type: ActivityType;
  subject: string;
  description?: string | null;
  relatedToType: "lead" | "deal" | "customer";
  relatedToId: string;
  completed: boolean;
  completedAt?: string | null;
  assignedTo: string;
  createdAt: string;
}

export interface CreateActivityRequest {
  type: ActivityType;
  subject: string;
  description?: string | null;
  relatedToType: "lead" | "deal" | "customer";
  relatedToId: string;
  relatedToName?: string | null;
  dueDate?: string | null;
  assignedTo: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
  lost: "Lost",
};

/**
 * Reasonable forward moves for a working lead. The backend's status PATCH accepts any string
 * (no server-side transition validation), so this is purely a UX guard, not an enforced rule.
 * "converted" is deliberately never reachable here -- that must go through convertLead, which
 * creates the account/contact/deal alongside it (see CLAUDE.md Module 8d); setting the status
 * directly would mark a lead converted without any of that actually happening.
 */
export const NEXT_STATUSES: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["lost"],
  unqualified: [],
  converted: [],
  lost: [],
};
