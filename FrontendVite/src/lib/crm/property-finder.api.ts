// CRM controllers return raw JSON — the Identity envelope ({ success, data }) is not applied to
// them, so apiClient would reject every 200 with a bare "HTTP 200".
import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/crm/property-finder`;

/** One Property Finder user, with everything needed to decide whether to give them a login. */
export interface PfAgentDto {
  pfUserId: number;
  /** The join key — leads reference their agent only by this, never by user id. */
  publicProfileId: number | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  status: "active" | "inactive" | string;
  roleName: string | null;
  baseRoleKey: string | null;
  /** How many leads this agent owns — the reason to import them at all. */
  leadCount: number;
  suggestedRole: string | null;
  /** Email already belongs to a login — here or in another workspace. */
  emailInUse: boolean;
  emailInUseNote: string | null;
}

export interface PfRoleDto {
  id: number;
  name: string;
  roleKey: string;
  baseRoleKey: string;
  isCustom: boolean;
}

export interface PfImportPreviewDto {
  roles: PfRoleDto[];
  agents: PfAgentDto[];
  totalPfUsers: number;
  activePfUsers: number;
  agentsOwningLeads: number;
  totalLeads: number;
  leadsWithKnownAgent: number;
  /** Owning agent no longer exists in PF — these need a fallback owner. */
  leadsWithUnknownAgent: number;
  /** Distinct phone numbers — what a phone dedupe actually produces. */
  distinctPeople: number;
  repeatEnquiries: number;
  oldestLeadAt: string | null;
  newestLeadAt: string | null;
}

export interface PfAgentAssignment {
  publicProfileId: number;
  userId: string;
  userName: string;
  /** The team this agent belongs to — a lead is filed to its OWNER's team, not one global team. */
  teamId?: string | null;
}

export interface PfLeadImportResultDto {
  leadsFetched: number;
  peopleImported: number;
  created: number;
  duplicates: number;
  failed: number;
  enquiriesLogged: number;
  unassigned: number;
  errors: string[];
  /** Total people (deduped) the whole import will cover. */
  totalPeople: number;
  /** Where the next batch should resume from. */
  nextSkip: number;
  hasMore: boolean;
}

export interface ImportLeadsRequest {
  assignments: PfAgentAssignment[];
  fallbackUserId?: string | null;
  fallbackUserName?: string | null;
  teamId?: string | null;
  dryRun: boolean;
  /** Batch window over the deduped people, so a closed tab cannot kill the whole import. */
  skip?: number;
  take?: number;
}

export const propertyFinderApi = {
  /** Read-only. Writes nothing to Property Finder or to our database. */
  preview: (): Promise<PfImportPreviewDto> => rawApiClient.get(`${BASE}/preview`),

  /**
   * Safe to re-run — intake dedupes on the Property Finder lead id. Send `dryRun: true` first to
   * see the counts without writing anything.
   */
  importLeads: (body: ImportLeadsRequest): Promise<PfLeadImportResultDto> =>
    rawApiClient.post(`${BASE}/import-leads`, body),
};

/**
 * Property Finder base role → the Vrodux role to create for it.
 *
 * The tier is the point: an agent gets the ASSIGNED tier so they see only their own leads. Giving
 * every agent the tenant-wide CRM Manager role would let all of them see every lead in the account,
 * which defeats importing lead ownership in the first place.
 */
export const PF_ROLE_TEMPLATES: Record<string, { role: string; permissions: string[]; description: string }> = {
  "PF Agent": {
    role: "PF Agent",
    description: "Property Finder agent — sees and works only the records assigned to them.",
    permissions: [
      // The -assigned tier, for EVERY area. The plain crm.leads.* / crm.pipeline.* /
      // crm.customers.* keys are tenant-wide: LeadAccessGuard treats them as full access, so
      // granting crm.pipeline.view here would let every agent read every opportunity in the
      // workspace — the opposite of what importing lead ownership is for.
      "crm.leads-assigned.view",     "crm.leads-assigned.edit",
      "crm.pipeline-assigned.view",  "crm.pipeline-assigned.edit",
      "crm.customers-assigned.view", "crm.customers-assigned.edit",
      // create/export have no tiered variant — creating is not a visibility grant, and an export
      // can only ever contain the rows the tiers above already allow.
      "crm.leads.create",    "crm.leads.export",
      "crm.pipeline.create",
      "crm.customers.create",
    ],
  },
  "CRM Team Lead": {
    role: "CRM Team Lead",
    description: "Leads a team — sees everything owned by the members of the teams they lead.",
    permissions: [
      // The -team tier across every area, so leads, opportunities and accounts are all scoped to
      // the same set of people rather than one area being tenant-wide.
      "crm.leads-team.view",     "crm.leads-team.edit",
      "crm.pipeline-team.view",  "crm.pipeline-team.edit",
      "crm.customers-team.view", "crm.customers-team.edit",
      "crm.leads.create",     "crm.leads.export",
      "crm.pipeline.create",  "crm.pipeline.export",
      "crm.customers.create", "crm.customers.export",
      // Reports are scoped internally by the same guard, so a team lead sees their team only.
      "crm.reports.view", "crm.reports.export",
      "file-manager.view",
      // Deliberately NOT crm.leads.delete: deletion is gated on that tenant-wide key alone and the
      // delete handler runs no per-record access check, so holding it would let a team lead remove
      // another team's leads.
    ],
  },
};
/**
 * Split agents across teams so each carries a similar share of the LEAD VOLUME, not a similar
 * head count.
 *
 * Splitting by head count would be meaningless here: the busiest agent owns 610 leads and the
 * quietest owns 1, so three equal-sized groups could differ tenfold in actual work. This is the
 * classic greedy longest-processing-time heuristic — take agents busiest-first and give each to
 * whichever team is currently lightest. Close enough to balanced, and stable: the same input
 * always produces the same split.
 */
export function balanceAgentsAcrossTeams<T extends { leadCount: number }>(
  agents: T[], teamCount: number, preassigned?: T[][],
): T[][] {
  const n = Math.max(1, teamCount);
  // A team lead belongs in their OWN team, so they are seeded rather than balanced — and their
  // lead count still counts toward that team's load, or the split would be skewed against it.
  const buckets: T[][] = Array.from({ length: n }, (_, i) => [...(preassigned?.[i] ?? [])]);
  const totals = buckets.map(b => b.reduce((s, a) => s + a.leadCount, 0));
  for (const agent of [...agents].sort((a, b) => b.leadCount - a.leadCount)) {
    let lightest = 0;
    for (let i = 1; i < totals.length; i++) if (totals[i] < totals[lightest]) lightest = i;
    buckets[lightest].push(agent);
    totals[lightest] += agent.leadCount;
  }
  return buckets;
}

// ── Live sync ─────────────────────────────────────────────────────────────────

export interface PfWebhookDto {
  eventId: string;
  url: string;
  createdAt: string | null;
  /** Points at THIS integration's inbound URL — Property Finder allows several per event. */
  isOurs: boolean;
}

export interface PfWebhookStatusDto {
  callbackUrl: string | null;
  /** True only when Property Finder itself reports a subscription for every event we need. */
  live: boolean;
  /** Why it is not live — usually an unreachable callback URL, which retrying will not fix. */
  blocker: string | null;
  subscriptions: PfWebhookDto[];
  missingEvents: string[];
  notes: string[];
}

export const propertyFinderCredentialsApi = {
  /**
   * Stores THIS workspace's Property Finder key. Credentials are per-tenant and encrypted at
   * rest — a key in shared configuration would let one agency import another agency's data.
   */
  set: (integrationId: string, apiKey: string, apiSecret: string): Promise<void> =>
    rawApiClient.put(`${BASE}/credentials/${integrationId}`, { apiKey, apiSecret }),
};

export const propertyFinderSyncApi = {
  status:    (integrationId: string): Promise<PfWebhookStatusDto> =>
    rawApiClient.get(`${BASE}/webhooks/${integrationId}`),
  subscribe: (integrationId: string): Promise<PfWebhookStatusDto> =>
    rawApiClient.post(`${BASE}/webhooks/${integrationId}`, {}),
};
