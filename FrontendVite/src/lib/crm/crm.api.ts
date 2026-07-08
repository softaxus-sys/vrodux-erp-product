import { rawApiClient } from "@/lib/api-client";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API_ROOT}/api/crm`;
// Bulk import funnels through the shared internal intake pipeline (dedupe + routing), not /api/crm.
const INTERNAL = `${API_ROOT}/api/internal`;

// ── Shared ─────────────────────────────────────────────────────────────────

export type DealStage    = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type DealPriority = "low" | "medium" | "high";
export type ForecastCategory = "pipeline" | "best_case" | "commit" | "closed" | "omitted";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task";

export type LeadStatus   = "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost";
export type LeadSource   =
  | "website" | "linkedin" | "referral" | "cold_call" | "trade_show"
  | "google_ads" | "email_campaign" | "partner" | "social_media" | "walk_in";
export type LeadPriority = "low" | "medium" | "high";

export type CustomerStatus = "active" | "inactive" | "at_risk" | "churned";
export type CustomerTier   = "standard" | "silver" | "gold" | "platinum";

// ── Pipeline / Deals ────────────────────────────────────────────────────────

export interface DealContact {
  name:  string;
  title: string;
  email: string;
  phone: string;
}

export interface DealActivity {
  id:          string;
  type:        ActivityType;
  title:       string;
  description: string;
  date:        string;
  by:          string;
}

export interface DealDto {
  id:                 string;
  title:              string;
  company:            string;
  value:              number;
  currency:           "AED" | "USD" | "SAR";
  stage:              DealStage;
  priority:           DealPriority;
  probability:        number;
  expectedCloseDate:  string;
  createdDate:        string;
  assignedTo:         string;
  source:             string;
  industry:           string;
  description:        string;
  tags:               string[];
  contact:            DealContact;
  activities:         DealActivity[];
  nextAction?:        string;
  nextActionDate?:    string;
  forecastCategory:   ForecastCategory;
  weightedValue:      number;
  lossReason?:        string | null;
  customerId?:        string | null;
}

export interface CrmSummaryDto {
  totalDeals:  number;
  totalValue:  number;
  wonValue:    number;
  lostDeals:   number;
  avgDealSize: number;
  winRate:     number;
  openValue:      number;
  weightedValue:  number;
  commitValue:    number;
  bestCaseValue:  number;
}

export const FORECAST_META: Record<ForecastCategory, { label: string; color: string; bg: string }> = {
  commit:    { label: "Commit",    color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/25" },
  best_case: { label: "Best case", color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-900/25" },
  pipeline:  { label: "Pipeline",  color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  closed:    { label: "Closed",    color: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-900/25" },
  omitted:   { label: "Omitted",   color: "text-red-600",     bg: "bg-red-100 dark:bg-red-900/25" },
};

export const PIPELINE_STAGES: { key: DealStage; label: string; color: string; bg: string }[] = [
  { key: "lead",        label: "Lead",        color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  { key: "qualified",   label: "Qualified",   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  { key: "proposal",    label: "Proposal",    color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  { key: "negotiation", label: "Negotiation", color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  { key: "won",         label: "Won",         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { key: "lost",        label: "Lost",        color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20" },
];

// ── Leads ───────────────────────────────────────────────────────────────────

export interface LeadActivity {
  id:          string;
  type:        "call" | "email" | "meeting" | "note" | "task";
  title:       string;
  description: string;
  date:        string;
  by:          string;
}

export interface LeadDto {
  id:               string;
  firstName:        string;
  lastName:         string;
  fullName:         string;
  title:            string;
  company:          string;
  industry:         string;
  email:            string;
  phone:            string;
  country:          string;
  city:             string;
  source:           LeadSource;
  status:           LeadStatus;
  priority:         LeadPriority;
  score:            number;
  estimatedValue:   number;
  currency:         "AED" | "USD" | "SAR";
  assignedTo:       string;
  /** Identity user id of the current owner (drives "my assigned leads" scoping). */
  assignedToUserId?: string | null;
  createdDate:      string;
  lastContactDate?: string;
  nextFollowUp?:    string;
  notes?:           string;
  tags:             string[];
  activities:       LeadActivity[];
  convertedDealId?: string;
  // ── Lead-gen / marketing capture (from Meta / Google / webhooks / forms) ──
  platform?:            string | null;   // meta / facebook / instagram / google / whatsapp …
  formName?:            string | null;
  isOrganic?:           boolean | null;
  campaign?:            string | null;
  adName?:              string | null;
  adSetName?:           string | null;
  whatsApp?:            string | null;
  interestedIn?:        string | null;
  budget?:              string | null;
  message?:             string | null;   // the lead's own message / enquiry
  platformCreatedTime?: string | null;
  /** Extra captured fields (survey Q&A / custom questions) as question → answer. */
  customFields?:        Record<string, string> | null;
}

export interface LeadsSummaryDto {
  total:               number;
  newThisWeek:         number;
  qualified:           number;
  contacted:           number;
  converted:           number;
  conversionRate:      number;
  totalEstimatedValue: number;
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website:        "Website",
  linkedin:       "LinkedIn",
  referral:       "Referral",
  cold_call:      "Cold Call",
  trade_show:     "Trade Show",
  google_ads:     "Google Ads",
  email_campaign: "Email Campaign",
  partner:        "Partner",
  social_media:   "Social Media",
  walk_in:        "Walk-in",
};

// ── Customers ───────────────────────────────────────────────────────────────

export interface CustomerContact {
  id:          string;
  name:        string;
  title:       string;
  email:       string;
  phone:       string;
  isPrimary:   boolean;
  department:  string;
}

export interface CustomerDeal {
  id:           string;
  title:        string;
  value:        number;
  currency:     string;
  status:       string;
  closedDate?:  string;
}

export interface CustomerActivity {
  id:          string;
  type:        "call" | "email" | "meeting" | "note" | "support";
  title:       string;
  description: string;
  date:        string;
  by:          string;
}

export interface CustomerDto {
  id:                string;
  name:              string;
  tradeName?:        string;
  industry:          string;
  website?:          string;
  country:           string;
  city:              string;
  address:           string;
  phone:             string;
  email:             string;
  status:            CustomerStatus;
  tier:              CustomerTier;
  accountManager:    string;
  since:             string;
  lastActivity?:     string;
  totalRevenue:      number;
  openDeals:         number;
  currency:          string;
  employees?:        string;
  description:       string;
  contacts:          CustomerContact[];
  deals:             CustomerDeal[];
  activities:        CustomerActivity[];
  tags:              string[];
  contractRenewal?:  string;
  npsScore?:         number;
}

export interface CustomersSummaryDto {
  total:        number;
  active:       number;
  inactive:     number;
  platinum:     number;
  gold:         number;
  totalRevenue: number;
  openDeals:    number;
  avgNps:       number;
}

// ── API ─────────────────────────────────────────────────────────────────────

// ── Activities ────────────────────────────────────────────────────────────────

export interface ActivityDto {
  id: string;
  type: ActivityType;
  subject: string;
  description?: string | null;
  relatedToType: "lead" | "deal" | "customer";
  relatedToId: string;
  relatedToName?: string | null;
  dueDate?: string | null;
  completed: boolean;
  completedAt?: string | null;
  assignedTo: string;
  createdAt: string;
  updatedAt?: string | null;
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
export interface ActivitiesSummaryDto { openTasks: number; overdue: number; dueToday: number; upcoming: number; }

// ── Request payloads ──────────────────────────────────────────────────────────

export interface CreateLeadRequest {
  firstName: string; lastName: string; title: string; company: string; industry: string;
  email: string; phone: string; country: string; city: string; source: string; priority: string;
  estimatedValue: number; assignedTo: string; notes?: string | null;
  whatsApp?: string | null; interestedIn?: string | null; budget?: string | null; message?: string | null;
  /** Identity user id of the owner picked in the assignee dropdown. */
  assignedToUserId?: string | null;
}
export interface UpdateLeadRequest extends CreateLeadRequest {
  score: number; nextFollowUp?: string | null; tags?: string[];
}

/** One handoff in a lead's assignment history (newest first). */
export interface LeadAssignmentDto {
  id: string;
  fromUserId?: string | null;
  fromUserName?: string | null;
  toUserId?: string | null;
  toUserName: string;
  assignedByUserId?: string | null;
  assignedByName?: string | null;
  note?: string | null;
  createdAt: string;
}

// ── Bulk import (Excel / CSV) ────────────────────────────────────────────────
/** One canonical lead row for bulk import. All fields optional; at least one of
 *  email / phone / fullName / firstName is required per row (enforced server-side). */
export interface ImportLeadInput {
  firstName?: string | null; lastName?: string | null; fullName?: string | null;
  email?: string | null; phone?: string | null; company?: string | null; title?: string | null;
  industry?: string | null; address?: string | null; city?: string | null; country?: string | null;
  notes?: string | null; source?: string | null; campaign?: string | null;
  whatsApp?: string | null; interestedIn?: string | null; budget?: string | null;
  message?: string | null; formName?: string | null;
  /** Any extra columns, kept raw so integration field-mappings can promote them. */
  fields?: Record<string, string | null> | null;
}
export interface ImportRowError { row: number; message: string; }
export interface ImportLeadsResult {
  created: number; duplicates: number; failed: number; errors: ImportRowError[];
}
/** CRM lead fields an import column can map onto. */
export const IMPORT_TARGET_FIELDS = [
  "firstName", "lastName", "fullName", "email", "phone", "company",
  "title", "industry", "address", "city", "country", "notes",
  "whatsApp", "interestedIn", "budget", "message", "campaign", "formName",
] as const;
export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];
export interface CreateDealRequest {
  title: string; company: string; value: number; stage: string; priority: string;
  probability: number; expectedCloseDate: string; assignedTo: string; source: string;
  industry: string; description: string; forecastCategory?: string; customerId?: string | null;
}
export interface UpdateDealRequest extends CreateDealRequest {
  nextAction?: string | null; nextActionDate?: string | null; tags?: string[];
}
export interface CreateCustomerRequest {
  name: string; industry: string; country: string; city: string; address: string;
  phone: string; email: string; tier: string; accountManager: string; description: string;
}
export interface UpdateCustomerRequest {
  name: string; industry: string; country: string; city: string; address: string;
  phone: string; email: string; status: string; tier: string; accountManager: string;
  description: string; website?: string | null; tradeName?: string | null; employees?: string | null;
  npsScore?: number | null; contractRenewal?: string | null; tags?: string[];
}

export interface CrmDashboardDto {
  leadFunnel: { stage: string; count: number }[];
  leadsBySource: { source: string; count: number }[];
  pipelineByStage: { stage: string; count: number; value: number }[];
  openPipelineValue: number; wonValue: number; wonCount: number; lostCount: number;
  winRate: number; totalLeads: number; totalDeals: number; openTasks: number; overdueTasks: number;
}

export const crmApi = {
  // Deals
  getDeals:      (customerId?: string): Promise<DealDto[]> => rawApiClient.get(`${BASE}/deals${customerId ? `?customerId=${customerId}` : ""}`),
  getCrmSummary: (): Promise<CrmSummaryDto>       => rawApiClient.get(`${BASE}/deals/summary`),
  getDeal:       (id: string): Promise<DealDto>   => rawApiClient.get(`${BASE}/deals/${id}`),
  createDeal:    (d: CreateDealRequest): Promise<DealDto> => rawApiClient.post(`${BASE}/deals`, d),
  updateDeal:    (id: string, d: UpdateDealRequest): Promise<void> => rawApiClient.put(`${BASE}/deals/${id}`, d),
  moveDealStage: (id: string, stage: string, probability: number, opts?: { forecastCategory?: string; lossReason?: string }): Promise<void> => rawApiClient.patch(`${BASE}/deals/${id}/stage`, { stage, probability, ...opts }),
  deleteDeal:    (id: string): Promise<void> => rawApiClient.delete(`${BASE}/deals/${id}`),

  // Leads
  getLeads:       (): Promise<LeadDto[]>          => rawApiClient.get(`${BASE}/leads`),
  getLeadsSummary:(): Promise<LeadsSummaryDto>    => rawApiClient.get(`${BASE}/leads/summary`),
  getLead:        (id: string): Promise<LeadDto>  => rawApiClient.get(`${BASE}/leads/${id}`),
  createLead:     (l: CreateLeadRequest): Promise<LeadDto> => rawApiClient.post(`${BASE}/leads`, l),
  updateLead:     (id: string, l: UpdateLeadRequest): Promise<void> => rawApiClient.put(`${BASE}/leads/${id}`, l),
  setLeadStatus:  (id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/leads/${id}/status`, { status }),
  setLeadScore:   (id: string, score: number): Promise<void> => rawApiClient.patch(`${BASE}/leads/${id}/score`, { score }),
  convertLead:    (id: string, body: { dealTitle?: string; dealValue?: number; expectedCloseDate?: string }): Promise<{ customerId: string; dealId: string }> => rawApiClient.post(`${BASE}/leads/${id}/convert`, body),
  assignLead:     (id: string, body: { toUserId?: string | null; toUserName: string; note?: string | null }): Promise<void> => rawApiClient.post(`${BASE}/leads/${id}/assign`, body),
  getLeadAssignments: (id: string): Promise<LeadAssignmentDto[]> => rawApiClient.get(`${BASE}/leads/${id}/assignments`),
  deleteLead:     (id: string): Promise<void> => rawApiClient.delete(`${BASE}/leads/${id}`),
  importLeads:    (leads: ImportLeadInput[]): Promise<ImportLeadsResult> => rawApiClient.post(`${INTERNAL}/leads/import`, { leads }),

  // Customers
  getCustomers:         (): Promise<CustomerDto[]>        => rawApiClient.get(`${BASE}/customers`),
  getCustomersSummary:  (): Promise<CustomersSummaryDto>  => rawApiClient.get(`${BASE}/customers/summary`),
  getCustomer:          (id: string): Promise<CustomerDto> => rawApiClient.get(`${BASE}/customers/${id}`),
  createCustomer:       (c: CreateCustomerRequest): Promise<CustomerDto> => rawApiClient.post(`${BASE}/customers`, c),
  updateCustomer:       (id: string, c: UpdateCustomerRequest): Promise<void> => rawApiClient.put(`${BASE}/customers/${id}`, c),
  deleteCustomer:       (id: string): Promise<void> => rawApiClient.delete(`${BASE}/customers/${id}`),

  // Activities
  getActivities:   (params?: { relatedToType?: string; relatedToId?: string; completed?: boolean; type?: string }): Promise<ActivityDto[]> => {
    const qs = new URLSearchParams();
    if (params?.relatedToType) qs.set("relatedToType", params.relatedToType);
    if (params?.relatedToId)   qs.set("relatedToId", params.relatedToId);
    if (params?.completed !== undefined) qs.set("completed", String(params.completed));
    if (params?.type)          qs.set("type", params.type);
    const s = qs.toString();
    return rawApiClient.get(`${BASE}/activities${s ? `?${s}` : ""}`);
  },
  getActivitiesSummary: (): Promise<ActivitiesSummaryDto> => rawApiClient.get(`${BASE}/activities/summary`),
  getCustomerTimeline:  (customerId: string): Promise<ActivityDto[]> => rawApiClient.get(`${BASE}/customers/${customerId}/timeline`),
  createActivity:  (a: CreateActivityRequest): Promise<ActivityDto> => rawApiClient.post(`${BASE}/activities`, a),
  updateActivity:  (id: string, a: { type: string; subject: string; description?: string | null; dueDate?: string | null; assignedTo: string }): Promise<void> => rawApiClient.put(`${BASE}/activities/${id}`, a),
  completeActivity:(id: string): Promise<void> => rawApiClient.post(`${BASE}/activities/${id}/complete`),
  reopenActivity:  (id: string): Promise<void> => rawApiClient.post(`${BASE}/activities/${id}/reopen`),
  deleteActivity:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/activities/${id}`),

  // Dashboard
  getDashboard: (): Promise<CrmDashboardDto> => rawApiClient.get(`${BASE}/dashboard`),

  // Contacts
  getContacts:      (customerId: string): Promise<ContactDto[]> => rawApiClient.get(`${BASE}/contacts?customerId=${customerId}`),
  createContact:    (c: UpsertContactRequest): Promise<ContactDto> => rawApiClient.post(`${BASE}/contacts`, c),
  updateContact:    (id: string, c: UpsertContactRequest): Promise<void> => rawApiClient.put(`${BASE}/contacts/${id}`, c),
  setPrimaryContact:(id: string): Promise<void> => rawApiClient.post(`${BASE}/contacts/${id}/primary`),
  deleteContact:    (id: string): Promise<void> => rawApiClient.delete(`${BASE}/contacts/${id}`),

  // Deal ↔ Contact roles
  getDealContacts:       (dealId: string): Promise<DealContactRoleDto[]> => rawApiClient.get(`${BASE}/deals/${dealId}/contacts`),
  addDealContact:        (dealId: string, body: { contactId: string; role: string }): Promise<DealContactRoleDto> => rawApiClient.post(`${BASE}/deals/${dealId}/contacts`, body),
  updateDealContactRole: (dealId: string, id: string, role: string): Promise<void> => rawApiClient.put(`${BASE}/deals/${dealId}/contacts/${id}`, { role }),
  removeDealContact:     (dealId: string, id: string): Promise<void> => rawApiClient.delete(`${BASE}/deals/${dealId}/contacts/${id}`),
};

export interface ContactDto {
  id: string; customerId: string; firstName: string; lastName: string; fullName: string;
  title: string; email: string; phone: string; department?: string | null;
  isPrimary: boolean; notes?: string | null;
}
export interface UpsertContactRequest {
  customerId: string; firstName: string; lastName: string; title: string;
  email: string; phone: string; department?: string | null; isPrimary: boolean; notes?: string | null;
}

export interface DealContactRoleDto {
  id: string; contactId: string; fullName: string; title: string; email: string;
  phone: string; department?: string | null; isPrimary: boolean; role: string;
}
export const DEAL_CONTACT_ROLES: { value: string; label: string }[] = [
  { value: "decision_maker", label: "Decision maker" },
  { value: "champion",       label: "Champion" },
  { value: "influencer",     label: "Influencer" },
  { value: "user",           label: "End user" },
  { value: "blocker",        label: "Blocker" },
  { value: "other",          label: "Other" },
];
