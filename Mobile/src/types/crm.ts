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

/** Badge tone per status -- consumed by <Badge tone={...}>. */
export const LEAD_STATUS_TONE: Record<LeadStatus, "success" | "warning" | "destructive" | "info" | "neutral" | "primary"> = {
  new: "info",
  contacted: "primary",
  qualified: "success",
  unqualified: "neutral",
  converted: "success",
  lost: "destructive",
};

// ── Deals / Pipeline ──────────────────────────────────────────────────────────

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type DealPriority = "low" | "medium" | "high";
export type ForecastCategory = "pipeline" | "best_case" | "commit" | "closed" | "omitted";

export interface DealContact {
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface DealDto {
  id: string;
  title: string;
  company: string;
  value: number;
  currency: "AED" | "USD" | "SAR";
  stage: DealStage;
  priority: DealPriority;
  probability: number;
  expectedCloseDate: string;
  createdDate: string;
  assignedTo: string;
  assignedToUserId?: string | null;
  source: string;
  description?: string | null;
  contact: DealContact;
  nextAction?: string | null;
  nextActionDate?: string | null;
  forecastCategory: ForecastCategory;
  weightedValue: number;
  closedValue?: number | null;
  realizedValue: number;
  lossReason?: string | null;
  customerId?: string | null;
}

export interface DealsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string;
}

export interface PagedDeals {
  items: DealDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface MoveDealStageOptions {
  forecastCategory?: string;
  lossReason?: string;
  closedValue?: number;
}

export interface ConvertLeadRequest {
  dealTitle?: string;
  dealValue?: number;
  expectedCloseDate?: string;
}

export interface ConvertLeadResult {
  customerId: string;
  dealId: string;
}

export const PIPELINE_STAGES: { key: DealStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

/** Default probability applied when a deal moves to a stage -- mirrors the web pipeline board's
 *  STAGE_PROBABILITY (drag-and-drop always sends one of these; only a manual edit overrides it). */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 10,
  qualified: 30,
  proposal: 60,
  negotiation: 80,
  won: 100,
  lost: 0,
};

/** Legal forward moves from a given stage -- "won"/"lost" are terminal, matching the web board. */
export const NEXT_STAGES: Record<DealStage, DealStage[]> = {
  lead: ["qualified", "lost"],
  qualified: ["proposal", "lost"],
  proposal: ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won: [],
  lost: [],
};

export const FORECAST_LABELS: Record<ForecastCategory, string> = {
  pipeline: "Pipeline",
  best_case: "Best case",
  commit: "Commit",
  closed: "Closed",
  omitted: "Omitted",
};

/** Badge tone per stage -- consumed by <Badge tone={...}>. */
export const DEAL_STAGE_TONE: Record<DealStage, "success" | "warning" | "destructive" | "info" | "neutral" | "primary"> = {
  lead: "neutral",
  qualified: "info",
  proposal: "primary",
  negotiation: "warning",
  won: "success",
  lost: "destructive",
};
