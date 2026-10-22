import { apiClient } from "@/lib/api-client";

/**
 * CRM write calls (create / edit / reassign). Kept apart from crm.api.ts (the read + status side) so the
 * mobile read DTOs stay trimmed. Every PUT on the CRM controllers REPLACES the record, so edits read the
 * full server copy first and send it back with only the changed fields overlaid -- otherwise fields the
 * mobile form does not show (industry, country, tags, score...) would be wiped on save.
 */
const BASE = "/api/crm";

export const CRM_LEADS_CREATE = ["crm.leads.create"];
export const CRM_PIPELINE_CREATE = ["crm.pipeline.create"];
export const CRM_CUSTOMERS_CREATE = ["crm.customers.create"];
export const CRM_CUSTOMERS_EDIT = ["crm.customers.edit", "crm.customers-team.edit", "crm.customers-assigned.edit"];

export interface AssignableUser {
  userId: string;
  fullName: string;
  email: string;
  isLead: boolean;
  teams?: { teamId: string; name: string }[];
}

export interface AccountLite {
  id: string;
  name: string;
  city?: string;
  tier?: string;
  status?: string;
  industry?: string;
  phone?: string;
  email?: string;
  accountManager?: string;
  totalRevenue?: number;
  openDeals?: number;
  currency?: string;
}

export interface PagedAccounts {
  items: AccountLite[];
  page: number;
  totalPages: number;
  totalCount: number;
}

export type LeadForm = {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  whatsApp: string;
  country: string;
  city: string;
  source: string;
  priority: string;
  estimatedValue: number;
  notes: string;
  interestedIn: string;
  budget: string;
  message: string;
  purchaseTimeframe: string;
  assignedToUserId: string | null;
  assignedTo: string;
  teamId: string | null;
};

type Raw = Record<string, unknown>;

export const crmWriteApi = {
  getAssignableUsers: (module = "crm"): Promise<AssignableUser[]> =>
    apiClient.get(`/api/teams/assignable-users?module=${encodeURIComponent(module)}`),

  // ── Leads ──────────────────────────────────────────────────────────────
  getLeadRaw: (id: string): Promise<Raw> => apiClient.get(`${BASE}/leads/${id}`),

  createLead: (f: LeadForm): Promise<{ id: string }> => apiClient.post(`${BASE}/leads`, f),

  updateLead: async (id: string, f: Partial<LeadForm>): Promise<void> => {
    const cur = await apiClient.get<Raw>(`${BASE}/leads/${id}`);
    const body: Raw = {
      firstName: cur.firstName, lastName: cur.lastName, title: cur.title, company: cur.company, industry: cur.industry,
      email: cur.email, phone: cur.phone, country: cur.country, city: cur.city, source: cur.source, priority: cur.priority,
      estimatedValue: cur.estimatedValue, assignedTo: cur.assignedTo, assignedToUserId: cur.assignedToUserId ?? null,
      teamId: cur.teamId ?? null, notes: cur.notes ?? null, whatsApp: cur.whatsApp ?? null, interestedIn: cur.interestedIn ?? null,
      budget: cur.budget ?? null, message: cur.message ?? null, purchaseTimeframe: cur.purchaseTimeframe ?? null,
      score: cur.score ?? 0, nextFollowUp: cur.nextFollowUp ?? null, tags: cur.tags ?? [],
      ...f,
    };
    await apiClient.put(`${BASE}/leads/${id}`, body);
  },

  assignLead: (id: string, body: { toUserId: string | null; toUserName: string; note?: string; teamId?: string | null }): Promise<void> =>
    apiClient.post(`${BASE}/leads/${id}/assign`, body),

  // ── Deals ──────────────────────────────────────────────────────────────
  createDeal: (d: {
    title: string; company: string; value: number; stage: string; priority: string; probability: number;
    expectedCloseDate: string; assignedTo: string; assignedToUserId: string | null; teamId: string | null;
    source: string; industry: string; description: string; customerId: string | null;
  }): Promise<{ id: string }> => apiClient.post(`${BASE}/deals`, d),

  updateDeal: async (id: string, f: Raw): Promise<void> => {
    const cur = await apiClient.get<Raw>(`${BASE}/deals/${id}`);
    const body: Raw = {
      title: cur.title, company: cur.company, value: cur.value, stage: cur.stage, priority: cur.priority,
      probability: cur.probability, expectedCloseDate: cur.expectedCloseDate, assignedTo: cur.assignedTo,
      assignedToUserId: cur.assignedToUserId ?? null, teamId: cur.teamId ?? null, source: cur.source,
      industry: cur.industry, description: cur.description, forecastCategory: cur.forecastCategory,
      customerId: cur.customerId ?? null, nextAction: cur.nextAction ?? null, nextActionDate: cur.nextActionDate ?? null,
      tags: cur.tags ?? [],
      ...f,
    };
    await apiClient.put(`${BASE}/deals/${id}`, body);
  },

  // ── Accounts (CRM customers) ──────────────────────────────────────────
  getAccounts: (p: { page?: number; pageSize?: number; search?: string } = {}): Promise<PagedAccounts> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 25));
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return apiClient.get(`${BASE}/customers?${qs}`);
  },

  getAccount: (id: string): Promise<Raw> => apiClient.get(`${BASE}/customers/${id}`),

  createAccount: (a: {
    name: string; industry: string; country: string; city: string; address: string; phone: string; email: string;
    tier: string; accountManager: string; accountManagerUserId: string | null; teamId: string | null;
    description: string; paymentTerms?: string | null;
  }): Promise<{ id: string }> => apiClient.post(`${BASE}/customers`, a),

  updateAccount: async (id: string, f: Raw): Promise<void> => {
    const cur = await apiClient.get<Raw>(`${BASE}/customers/${id}`);
    const body: Raw = {
      name: cur.name, industry: cur.industry, country: cur.country, city: cur.city, address: cur.address, phone: cur.phone,
      email: cur.email, status: cur.status, tier: cur.tier, accountManager: cur.accountManager,
      accountManagerUserId: cur.accountManagerUserId ?? null, teamId: cur.teamId ?? null, description: cur.description,
      website: cur.website ?? null, tradeName: cur.tradeName ?? null, employees: cur.employees ?? null,
      npsScore: cur.npsScore ?? null, contractRenewal: cur.contractRenewal ?? null, tags: cur.tags ?? [],
      paymentTerms: cur.paymentTerms ?? null,
      ...f,
    };
    await apiClient.put(`${BASE}/customers/${id}`, body);
  },
};

/** Option lists shared by the CRM forms (mirror the web app's pickers). */
export const LEAD_SOURCES = [
  "website", "referral", "social_media", "google_ads", "email_campaign", "walk_in", "cold_call", "trade_show", "partner", "linkedin",
].map((v) => ({ value: v, label: v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) }));

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const TIMEFRAMES = ["Immediately", "Within 1 month", "1-3 months", "3-6 months", "6+ months"].map((v) => ({ value: v, label: v }));

export const CUSTOMER_TIERS = ["standard", "silver", "gold", "platinum"].map((v) => ({ value: v, label: v.replace(/^./, (c) => c.toUpperCase()) }));
