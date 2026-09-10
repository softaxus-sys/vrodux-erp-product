import { apiClient } from "@/lib/api-client";
import type {
  ActivityDto,
  ConvertLeadRequest,
  ConvertLeadResult,
  CreateActivityRequest,
  DealDto,
  DealsPageParams,
  LeadDto,
  LeadsPageParams,
  MoveDealStageOptions,
  PagedDeals,
  PagedLeads,
} from "@/types/crm";

const BASE = "/api/crm";

/** Permission tiers a caller may hold for CRM leads -- full / team-scoped / assigned-only.
 *  Mirrors LeadsController's [RequireAnyPermission] on each action (view vs. edit set). */
export const CRM_LEADS_VIEW = ["crm.leads.view", "crm.leads-team.view", "crm.leads-assigned.view"];
export const CRM_LEADS_EDIT = ["crm.leads.edit", "crm.leads-team.edit", "crm.leads-assigned.edit"];

/** Same tier pattern, for opportunities. Mirrors PipelineController's [RequireAnyPermission]. */
export const CRM_PIPELINE_VIEW = ["crm.pipeline.view", "crm.pipeline-team.view", "crm.pipeline-assigned.view"];
export const CRM_PIPELINE_EDIT = ["crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit"];

function buildLeadsQuery(p: LeadsPageParams): string {
  const qs = new URLSearchParams();
  if (p.page) qs.set("page", String(p.page));
  if (p.pageSize) qs.set("pageSize", String(p.pageSize));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  if (p.sortBy) qs.set("sortBy", p.sortBy);
  if (p.sortDesc !== undefined) qs.set("sortDesc", String(p.sortDesc));
  return qs.toString();
}

function buildDealsQuery(p: DealsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.stage && p.stage !== "all") qs.set("stage", p.stage);
  return qs.toString();
}

export const crmApi = {
  // ── Leads ──────────────────────────────────────────────────────────────
  getLeadsPaged: (params: LeadsPageParams = {}): Promise<PagedLeads> =>
    apiClient.get(`${BASE}/leads/paged?${buildLeadsQuery(params)}`),

  getLead: (id: string): Promise<LeadDto> => apiClient.get(`${BASE}/leads/${id}`),

  setLeadStatus: (id: string, status: string): Promise<void> =>
    apiClient.patch(`${BASE}/leads/${id}/status`, { status }),

  /** Creates the account/contact/deal in one step -- never set status="converted" via setLeadStatus. */
  convertLead: (id: string, body: ConvertLeadRequest): Promise<ConvertLeadResult> =>
    apiClient.post(`${BASE}/leads/${id}/convert`, body),

  // ── Deals / Pipeline ───────────────────────────────────────────────────
  getDealsPaged: (params: DealsPageParams = {}): Promise<PagedDeals> =>
    apiClient.get(`${BASE}/deals/paged?${buildDealsQuery(params)}`),

  getDeal: (id: string): Promise<DealDto> => apiClient.get(`${BASE}/deals/${id}`),

  moveDealStage: (id: string, stage: string, probability: number, opts?: MoveDealStageOptions): Promise<void> =>
    apiClient.patch(`${BASE}/deals/${id}/stage`, { stage, probability, ...opts }),

  // ── Activities (shared across leads/deals/customers) ──────────────────
  getActivities: (relatedToType: "lead" | "deal" | "customer", relatedToId: string): Promise<ActivityDto[]> =>
    apiClient.get(`${BASE}/activities?relatedToType=${relatedToType}&relatedToId=${relatedToId}`),

  createActivity: (a: CreateActivityRequest): Promise<ActivityDto> =>
    apiClient.post(`${BASE}/activities`, a),

  completeActivity: (id: string): Promise<void> => apiClient.post(`${BASE}/activities/${id}/complete`),
};
