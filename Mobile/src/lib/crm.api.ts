import { apiClient } from "@/lib/api-client";
import type {
  ActivityDto,
  CreateActivityRequest,
  LeadDto,
  LeadsPageParams,
  PagedLeads,
} from "@/types/crm";

const BASE = "/api/crm";

/** Permission tiers a caller may hold for CRM leads -- full / team-scoped / assigned-only.
 *  Mirrors LeadsController's [RequireAnyPermission] on each action (view vs. edit set). */
export const CRM_LEADS_VIEW = ["crm.leads.view", "crm.leads-team.view", "crm.leads-assigned.view"];
export const CRM_LEADS_EDIT = ["crm.leads.edit", "crm.leads-team.edit", "crm.leads-assigned.edit"];

function buildQuery(p: LeadsPageParams): string {
  const qs = new URLSearchParams();
  if (p.page) qs.set("page", String(p.page));
  if (p.pageSize) qs.set("pageSize", String(p.pageSize));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  if (p.sortBy) qs.set("sortBy", p.sortBy);
  if (p.sortDesc !== undefined) qs.set("sortDesc", String(p.sortDesc));
  return qs.toString();
}

export const crmApi = {
  getLeadsPaged: (params: LeadsPageParams = {}): Promise<PagedLeads> =>
    apiClient.get(`${BASE}/leads/paged?${buildQuery(params)}`),

  getLead: (id: string): Promise<LeadDto> => apiClient.get(`${BASE}/leads/${id}`),

  setLeadStatus: (id: string, status: string): Promise<void> =>
    apiClient.patch(`${BASE}/leads/${id}/status`, { status }),

  getLeadActivities: (leadId: string): Promise<ActivityDto[]> =>
    apiClient.get(`${BASE}/activities?relatedToType=lead&relatedToId=${leadId}`),

  createActivity: (a: CreateActivityRequest): Promise<ActivityDto> =>
    apiClient.post(`${BASE}/activities`, a),

  completeActivity: (id: string): Promise<void> => apiClient.post(`${BASE}/activities/${id}/complete`),
};
