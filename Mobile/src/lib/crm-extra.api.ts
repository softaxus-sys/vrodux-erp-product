import { apiClient } from "@/lib/api-client";
import type { ActivityDto } from "@/types/crm";

/**
 * The CRM pieces that sit around leads / opportunities / accounts: contacts, opportunity contact roles,
 * assignment history, the account timeline, the tasks list and the eight reports.
 */
const BASE = "/api/crm";

export const CRM_REPORTS_VIEW = ["crm.reports.view"];
export const CRM_CONTACTS_EDIT = ["crm.customers.edit", "crm.customers-team.edit", "crm.customers-assigned.edit"];

// ── Contacts ────────────────────────────────────────────────────────────────────────────────────
export interface ContactDto {
  id: string; customerId: string; firstName: string; lastName: string; fullName: string;
  title: string; email: string; phone: string; department?: string | null; isPrimary: boolean; notes?: string | null;
}
export interface UpsertContactRequest {
  customerId: string; firstName: string; lastName: string; title: string; email: string; phone: string;
  department?: string | null; isPrimary: boolean; notes?: string | null;
}
export interface DealContactRoleDto {
  id: string; contactId: string; fullName: string; title: string; email: string; phone: string;
  department?: string | null; isPrimary: boolean; role: string;
}
export const DEAL_CONTACT_ROLES: { value: string; label: string }[] = [
  { value: "decision_maker", label: "Decision maker" },
  { value: "champion", label: "Champion" },
  { value: "influencer", label: "Influencer" },
  { value: "user", label: "End user" },
  { value: "blocker", label: "Blocker" },
  { value: "other", label: "Other" },
];

export interface LeadAssignmentDto {
  id: string; fromUserName?: string | null; toUserName: string; assignedByName?: string | null; note?: string | null; createdAt: string;
}

export interface PagedActivities { items: ActivityDto[]; page: number; pageSize: number; totalCount: number; totalPages: number }
export interface ActivitiesSummaryDto { openTasks: number; overdue: number; dueToday: number; upcoming: number }
export interface ActivityPageParams { page?: number; pageSize?: number; completed?: boolean; dueBefore?: string; dueOn?: string; search?: string }

export interface AccountDetail {
  id: string; name: string; industry?: string; country?: string; city?: string; address?: string; phone?: string; email?: string;
  website?: string; status?: string; tier?: string; accountManager?: string; description?: string; currency?: string;
  totalRevenue?: number; openDeals?: number;
}

export const crmExtraApi = {
  getAccount: (id: string) => apiClient.get<AccountDetail>(`${BASE}/customers/${id}`),
  getCustomerTimeline: (id: string) => apiClient.get<ActivityDto[]>(`${BASE}/customers/${id}/timeline`),

  getContacts: (customerId: string) => apiClient.get<ContactDto[]>(`${BASE}/contacts?customerId=${customerId}`),
  createContact: (c: UpsertContactRequest) => apiClient.post<ContactDto>(`${BASE}/contacts`, c),
  updateContact: (id: string, c: UpsertContactRequest) => apiClient.put<void>(`${BASE}/contacts/${id}`, c),
  setPrimaryContact: (id: string) => apiClient.post<void>(`${BASE}/contacts/${id}/primary`),
  deleteContact: (id: string) => apiClient.delete<void>(`${BASE}/contacts/${id}`),

  getDealContacts: (dealId: string) => apiClient.get<DealContactRoleDto[]>(`${BASE}/deals/${dealId}/contacts`),
  addDealContact: (dealId: string, body: { contactId: string; role: string }) => apiClient.post<DealContactRoleDto>(`${BASE}/deals/${dealId}/contacts`, body),
  updateDealContactRole: (dealId: string, id: string, role: string) => apiClient.put<void>(`${BASE}/deals/${dealId}/contacts/${id}`, { role }),
  removeDealContact: (dealId: string, id: string) => apiClient.delete<void>(`${BASE}/deals/${dealId}/contacts/${id}`),

  getLeadAssignments: (id: string) => apiClient.get<LeadAssignmentDto[]>(`${BASE}/leads/${id}/assignments`),
  getDealsForAccount: (customerId: string) => apiClient.get<any[]>(`${BASE}/deals?customerId=${customerId}`),

  getActivitiesPaged: (p: ActivityPageParams = {}) => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.completed !== undefined) qs.set("completed", String(p.completed));
    if (p.search) qs.set("search", p.search);
    if (p.dueBefore) qs.set("dueBefore", p.dueBefore);
    if (p.dueOn) qs.set("dueOn", p.dueOn);
    return apiClient.get<PagedActivities>(`${BASE}/activities/paged?${qs}`);
  },
  getActivitiesSummary: () => apiClient.get<ActivitiesSummaryDto>(`${BASE}/activities/summary`),
  reopenActivity: (id: string) => apiClient.post<void>(`${BASE}/activities/${id}/reopen`),

  getReport: <T = Record<string, any>>(id: string, range: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    const s = qs.toString();
    return apiClient.get<T>(`${BASE}/reports/${id}${s ? `?${s}` : ""}`);
  },
};
