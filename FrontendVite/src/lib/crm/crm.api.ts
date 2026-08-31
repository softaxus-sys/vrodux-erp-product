import { rawApiClient } from "@/lib/api-client";
import i18n from "@/i18n";

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
  /** Owning user — drives the assigned-only / my-team visibility tiers. */
  assignedToUserId?:  string | null;
  /** Team the record belongs to — null = untagged (visibility falls back to owner membership). */
  teamId?:            string | null;
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
  teamId?: string | null;
  /**
   * What became of the opportunity this lead converted into. A lead is never itself won or lost —
   * that is a deal outcome — so this is how a converted lead reports its result.
   */
  convertedDealStage?: DealStage | null;
  convertedDealValue?: number | null;
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
  /** Free-text "when planning to buy/invest" answer. */
  purchaseTimeframe?:   string | null;
  /** Classified urgency bucket key derived from purchaseTimeframe (see URGENCY_META). */
  purchaseUrgency?:     PurchaseUrgency | null;
}

export type PurchaseUrgency = "immediate" | "1_month" | "1_3_months" | "3_6_months" | "6_plus" | "unknown";

/** UI metadata per urgency bucket (label + colors). `unknown` renders no badge. */
export const URGENCY_META: Record<Exclude<PurchaseUrgency, "unknown">, { label: string; color: string; bg: string }> = {
  immediate:   { label: "Immediate",      color: "text-destructive",  bg: "bg-destructive/10" },
  "1_month":   { label: "Within 1 month", color: "text-warning",      bg: "bg-warning/10" },
  "1_3_months":{ label: "1–3 months",     color: "text-amber-600",    bg: "bg-amber-100 dark:bg-amber-900/20" },
  "3_6_months":{ label: "3–6 months",     color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-900/20" },
  "6_plus":    { label: "6+ months",      color: "text-muted-foreground", bg: "bg-muted" },
};

/** Standard purchase-timeframe options for the manual Add/Edit Lead form (stored as the raw
 *  text — the backend classifier maps it to an urgency bucket, same as inbound free text). */
export const TIMEFRAME_OPTIONS = [
  "Immediately", "Within 1 month", "1-3 months", "3-6 months", "6+ months",
] as const;

/** Compact "in words" money — e.g. 6_000_000 → "PKR 6M", 750_000 → "PKR 750K", 1.2e9 → "PKR 1.2B".
 *  Uses the tenant's operating currency code. Returns "—" for missing/zero. */
export function formatCompactValue(amount: number | null | undefined, currency: string): string {
  if (!amount || amount <= 0) return "—";
  const abs = Math.abs(amount);
  const trim = (n: number) => (Math.round(n * 10) / 10).toString();
  let num: string;
  if (abs >= 1e9)      num = trim(amount / 1e9) + "B";
  else if (abs >= 1e6) num = trim(amount / 1e6) + "M";
  else if (abs >= 1e3) num = trim(amount / 1e3) + "K";
  else                 num = String(Math.round(amount));
  return `${currency} ${num}`;
}

/** Lead temperature derived from the intent score — the at-a-glance "should I call this now?" signal. */
/**
 * The date a lead actually arose, for display and sorting.
 *
 * Leads captured from a platform carry the moment the enquiry was made there
 * (`platformCreatedTime` — Property Finder's `createdAt`, Meta's `created_time`). That is not the
 * same as `createdDate`, which is when the record reached this CRM: a poll sync or a bulk import
 * can land days later, so showing only `createdDate` makes every backfilled lead look like it came
 * in today. Prefer the platform date, fall back to ours.
 *
 * `platformCreatedTime` is stored as the raw string the source sent, so it is validated here rather
 * than trusted — an unparseable value falls back instead of rendering as an invalid date.
 */
export interface LeadsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /** A lead status, or "open" for everything still being worked. */
  status?: string;
  source?: string;
  /** An owner user id, "unassigned", or a legacy owner name. */
  assignee?: string;
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

export interface PagedActivities {
  items: ActivityDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ActivityPageParams {
  page?: number;
  pageSize?: number;
  completed?: boolean;
  type?: string;
  search?: string;
  /** yyyy-MM-dd — activities due strictly before this date (the "overdue" tab). */
  dueBefore?: string;
  /** yyyy-MM-dd — activities due on this exact date (the "today" tab). */
  dueOn?: string;
}

export function leadDate(
  lead: Pick<LeadDto, "createdDate" | "platformCreatedTime">,
): { value: string; fromPlatform: boolean } {
  const raw = lead.platformCreatedTime?.trim();
  if (raw && !Number.isNaN(new Date(raw).getTime())) {
    return { value: raw, fromPlatform: true };
  }
  return { value: lead.createdDate, fromPlatform: false };
}

export function leadHeat(score: number): { label: string; color: string; bg: string; emoji: string } {
  if (score >= 70) return { label: i18n.t("crm:heat.hot"),  color: "text-destructive", bg: "bg-destructive/10",              emoji: "🔥" };
  if (score >= 40) return { label: i18n.t("crm:heat.warm"), color: "text-warning",     bg: "bg-warning/10",                  emoji: "🌤️" };
  return             { label: i18n.t("crm:heat.cold"), color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20", emoji: "❄️" };
}

/**
 * Industry values that mark a lead as visa/immigration work.
 * `INDUSTRIES` in add-lead-form offers "Visa Services"; the others are accepted because leads
 * imported or captured from integrations carry whatever the source called it.
 */
const VISA_INDUSTRIES = ["visa services", "visa", "immigration"];

/**
 * Keywords used as a FALLBACK when the industry is not set. Inbound leads (Meta forms, imports,
 * webhooks) rarely populate `industry`, so relying on it alone would hide the Visa Case action on
 * exactly the leads that need it most.
 */
const VISA_KEYWORDS = [
  "visa", "immigration", "residency", "residence permit", "work permit",
  "golden visa", "freelance permit", "iqama", "emirates id", "citizenship",
];

/**
 * Is this lead visa/immigration business?
 *
 * Structured signal first (industry), then a keyword scan of what the lead actually asked for.
 * Deliberately generous: a false positive only shows an extra button, whereas a false negative
 * hides a useful shortcut. To force it on, set the lead's industry to "Visa Services".
 */
export function isVisaLead(
  lead: Pick<LeadDto, "industry" | "interestedIn" | "message" | "source">,
): boolean {
  const industry = (lead.industry ?? "").trim().toLowerCase();
  if (industry && VISA_INDUSTRIES.includes(industry)) return true;

  const haystack = [lead.interestedIn, lead.message, lead.source]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.length > 0 && VISA_KEYWORDS.some((k) => haystack.includes(k));
}

/** A short human summary of what the lead wants — assembled from the captured intent fields.
 *  Falls back to the lead's own message, then to "—". Used on cards + the drawer. */
export function buildLeadSummary(lead: Pick<LeadDto, "interestedIn" | "budget" | "purchaseTimeframe" | "purchaseUrgency" | "message" | "company">): string {
  const parts: string[] = [];
  if (lead.interestedIn) parts.push(lead.interestedIn.trim());
  if (lead.budget) parts.push(i18n.t("crm:summary.budget", { value: lead.budget.trim() }));
  const urg = lead.purchaseUrgency && lead.purchaseUrgency !== "unknown" ? i18n.t(`crm:urgency.${lead.purchaseUrgency}`) : null;
  if (urg) parts.push(urg);
  if (parts.length) return parts.join(" · ");
  if (lead.message) return lead.message.trim().replace(/\s+/g, " ").slice(0, 140);
  if (lead.company) return lead.company.trim();
  return "—";
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

/**
 * Human label for a lead source. `source` is typed as `LeadSource` but at runtime
 * it can be any provider key (e.g. "meta", "import", "property-finder", "facebook")
 * coming from the integration platform — those aren't in SOURCE_LABELS and would
 * render as an empty `<option>`. Fall back to a humanized version of the raw key.
 */
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  const humanized = source
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  // Known sources have a translation key; unknown provider keys fall back to humanized.
  return i18n.t(`crm:source.${source}`, { defaultValue: humanized });
}

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
  /** Owning user — drives the assigned-only / my-team visibility tiers. */
  accountManagerUserId?: string | null;
  /** Team the account belongs to — null = untagged. */
  teamId?: string | null;
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
  purchaseTimeframe?: string | null;
  /** Identity user id of the owner picked in the assignee dropdown. */
  assignedToUserId?: string | null;
  /** Team the record belongs to — null = untagged (falls back to owner membership). */
  teamId?: string | null;
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
  message?: string | null; formName?: string | null; timeframe?: string | null;
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
  "whatsApp", "interestedIn", "budget", "message", "timeframe", "campaign", "formName",
] as const;
export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];
export interface CreateDealRequest {
  title: string; company: string; value: number; stage: string; priority: string;
  probability: number; expectedCloseDate: string; assignedTo: string; assignedToUserId?: string | null;
  teamId?: string | null; source: string;
  industry: string; description: string; forecastCategory?: string; customerId?: string | null;
}
export interface UpdateDealRequest extends CreateDealRequest {
  nextAction?: string | null; nextActionDate?: string | null; tags?: string[];
}
export interface CreateCustomerRequest {
  name: string; industry: string; country: string; city: string; address: string;
  phone: string; email: string; tier: string; accountManager: string; accountManagerUserId?: string | null; teamId?: string | null; description: string;
}
export interface UpdateCustomerRequest {
  name: string; industry: string; country: string; city: string; address: string;
  phone: string; email: string; status: string; tier: string; accountManager: string; accountManagerUserId?: string | null; teamId?: string | null;
  description: string; website?: string | null; tradeName?: string | null; employees?: string | null;
  npsScore?: number | null; contractRenewal?: string | null; tags?: string[];
}

export interface CrmDashboardDto {
  leadFunnel: { stage: string; count: number }[];
  leadsBySource: { source: string; count: number }[];
  pipelineByStage: { stage: string; count: number; value: number }[];
  /** New/converted counts per month of the current year, aggregated server-side. */
  leadsByMonth: { month: number; newLeads: number; converted: number }[];
  openPipelineValue: number; wonValue: number; wonCount: number; lostCount: number;
  winRate: number; totalLeads: number; totalDeals: number; openTasks: number; overdueTasks: number;
}

export interface BulkFileResult {
  filed: number;
  skipped: number;
  /** Also changed owner, because whoever held them was not in the destination team. */
  reassigned: number;
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
  /**
   * The list screen. Filtering, sorting and paging happen server-side — a tenant here holds ~6,000
   * leads, and fetching them all to filter in the browser took over ten seconds.
   */
  getLeadsPaged: (p: LeadsPageParams = {}): Promise<PagedLeads> => {
    const qs = new URLSearchParams();
    if (p.page)     qs.set("page",     String(p.page));
    if (p.pageSize) qs.set("pageSize", String(p.pageSize));
    if (p.search?.trim())            qs.set("search",   p.search.trim());
    if (p.status   && p.status   !== "all") qs.set("status",   p.status);
    if (p.source   && p.source   !== "all") qs.set("source",   p.source);
    if (p.assignee && p.assignee !== "all") qs.set("assignee", p.assignee);
    if (p.sortBy)   qs.set("sortBy",   p.sortBy);
    if (p.sortDesc !== undefined) qs.set("sortDesc", String(p.sortDesc));
    return rawApiClient.get(`${BASE}/leads/paged?${qs}`);
  },

  /** Every lead the caller can see. Only for the board view and exports — see getLeadsPaged. */
  getLeads:       (): Promise<LeadDto[]>          => rawApiClient.get(`${BASE}/leads`),
  getLeadsSummary:(): Promise<LeadsSummaryDto>    => rawApiClient.get(`${BASE}/leads/summary`),
  getLead:        (id: string): Promise<LeadDto>  => rawApiClient.get(`${BASE}/leads/${id}`),
  createLead:     (l: CreateLeadRequest): Promise<LeadDto> => rawApiClient.post(`${BASE}/leads`, l),
  updateLead:     (id: string, l: UpdateLeadRequest): Promise<void> => rawApiClient.put(`${BASE}/leads/${id}`, l),
  setLeadStatus:  (id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/leads/${id}/status`, { status }),
  setLeadScore:   (id: string, score: number): Promise<void> => rawApiClient.patch(`${BASE}/leads/${id}/score`, { score }),
  convertLead:    (id: string, body: { dealTitle?: string; dealValue?: number; expectedCloseDate?: string }): Promise<{ customerId: string; dealId: string }> => rawApiClient.post(`${BASE}/leads/${id}/convert`, body),
  assignLead:     (id: string, body: { toUserId?: string | null; toUserName: string; note?: string | null; teamId?: string | null }): Promise<void> => rawApiClient.post(`${BASE}/leads/${id}/assign`, body),
  getLeadAssignments: (id: string): Promise<LeadAssignmentDto[]> => rawApiClient.get(`${BASE}/leads/${id}/assignments`),
  /** File many leads to a team at once; null teamId un-files them. Returns filed/skipped counts. */
  bulkFileLeadsToTeam: (leadIds: string[], teamId: string | null, assignToUserId: string | null = null): Promise<BulkFileResult> =>
    rawApiClient.post(`${BASE}/leads/bulk-file-to-team`, { leadIds, teamId, assignToUserId }),
  bulkFileDealsToTeam: (dealIds: string[], teamId: string | null): Promise<BulkFileResult> =>
    rawApiClient.post(`${BASE}/deals/bulk-file-to-team`, { dealIds, teamId }),
  bulkFileCustomersToTeam: (customerIds: string[], teamId: string | null): Promise<BulkFileResult> =>
    rawApiClient.post(`${BASE}/customers/bulk-file-to-team`, { customerIds, teamId }),
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
  /** The list screen. Filtering, searching and paging happen in SQL — see getActivities above,
   *  which stays for the record drawers (a lead/deal/account passes relatedToId). */
  getActivitiesPaged: (p: ActivityPageParams = {}): Promise<PagedActivities> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.completed !== undefined) qs.set("completed", String(p.completed));
    if (p.type)      qs.set("type", p.type);
    if (p.search)    qs.set("search", p.search);
    if (p.dueBefore) qs.set("dueBefore", p.dueBefore);
    if (p.dueOn)     qs.set("dueOn", p.dueOn);
    return rawApiClient.get(`${BASE}/activities/paged?${qs}`);
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
