import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/crm/integrations`;

// ── Types (mirror Softaxis.CRM Integration DTOs) ─────────────────────────────

export type IntegrationStatus = "connected" | "disconnected" | "error";
export type IntegrationHealth = "healthy" | "degraded" | "down" | "unknown";

export type ProviderCapability =
  | "oAuth" | "webhook" | "pollSync" | "apiKey" | "inboundKey" | "manualImport";

export interface ProviderCatalogItem {
  key:           string;
  displayName:   string;
  category:      string;
  description:   string;
  capabilities:  ProviderCapability[];
  comingSoon:    boolean;
  connected:     boolean;
  integrationId: string | null;
  status:        IntegrationStatus | null;
  health:        IntegrationHealth | null;
  lastSyncAt:    string | null;
}

export interface FieldMapping  { id: string; sourceField: string; targetField: string; }
export interface IntegrationResource {
  id: string; resourceType: string; externalId: string; name: string;
  parentExternalId: string | null; enabled: boolean;
}

export interface LeadBackfillResult {
  fetched: number; created: number; duplicates: number; failed: number;
  sinceUsed: string; note?: string | null;
}

export interface Integration {
  id:            string;
  providerKey:   string;
  name:          string;
  status:        IntegrationStatus;
  health:        IntegrationHealth;
  config:        string | null;
  dedupeConfig:  string | null;
  routingConfig: string | null;
  inboundUrl:    string | null;
  hasCredentials: boolean;
  /** Names of the stored credential fields — never the values. Empty on list responses. */
  credentialFields?: string[];
  lastSyncAt:    string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError:     string | null;
  retryCount:    number;
  createdAt:     string;
  updatedAt:     string | null;
  fieldMappings: FieldMapping[];
  resources:     IntegrationResource[];
}

export interface SyncLog {
  id: string; trigger: string; status: string; fetched: number; created: number;
  duplicates: number; failed: number; message: string | null;
  startedAt: string; completedAt: string | null;
}

export interface RawLeadInboxEntry {
  id: string; providerKey: string; externalId: string | null; status: string;
  attempts: number; lastError: string | null; createdLeadId: string | null;
  receivedAt: string; processedAt: string | null;
}

export interface IntegrationSecret { inboundUrl: string | null; signingSecret: string | null; }

// ── Lead Inbox (tenant-wide inbound feed) ────────────────────────────────────

/** One inbound delivery. The list row carries no payload — that arrives with the detail call. */
export interface LeadInboxRow {
  id: string; integrationId: string; providerKey: string; integrationName: string;
  externalId: string | null; status: string; attempts: number; lastError: string | null;
  createdLeadId: string | null; createdLeadName: string | null;
  receivedAt: string; processedAt: string | null; nextAttemptAt: string | null;
}
/** A delivery with the raw payload exactly as the provider sent it. */
export interface LeadInboxEntry extends LeadInboxRow { payload: string; }

export interface LeadInboxProviderCount { providerKey: string; name: string; total: number; failed: number; }
export interface LeadInboxSummary {
  total: number; pending: number; processed: number; duplicates: number; failed: number;
  byProvider: LeadInboxProviderCount[];
}
export interface LeadInboxPage {
  items: LeadInboxRow[]; page: number; pageSize: number; totalCount: number;
  totalPages: number; hasNext: boolean; hasPrev: boolean;
}
export interface LeadInboxFilters {
  page?: number; pageSize?: number; status?: string; search?: string;
  /** Scope to one connected integration — a Property Finder log never shows a Bayut payload. */
  integrationId?: string;
  provider?: string;
}

// ── Assignment backfill ──────────────────────────────────────────────────────

/** One historical lead and the owner the portal rules resolve for it. */
export interface LeadAssignmentCandidate {
  leadId: string; leadName: string; phone: string | null; createdAt: string;
  listingReference: string | null; agentName: string | null;
  currentOwnerName: string | null;
  resolvedUserId: string | null; resolvedUserName: string | null; resolvedTeamId: string | null;
  /** Why nothing resolved — shown instead of a blank row. */
  reason: string | null;
}
export interface LeadAssignmentBackfillPreview {
  total: number; resolvable: number; alreadyOwned: number; unresolvable: number;
  candidates: LeadAssignmentCandidate[];
}
export interface LeadAssignmentBackfillResult { assigned: number; skipped: number; }

/** Statuses a delivery can be in, in the order the page shows them. */
export const LEAD_INBOX_STATUSES = ["pending", "processing", "processed", "duplicate", "failed"] as const;

export interface FieldMappingInput { sourceField: string; targetField: string; }
export interface UpdateConfigRequest {
  config?: string | null; dedupeConfig?: string | null;
  routingConfig?: string | null; fieldMappings?: FieldMappingInput[];
}

// ── Meta ─────────────────────────────────────────────────────────────────────
export interface MetaPage { pageId: string; name: string; enabled: boolean; }
export interface MetaForm { formId: string; name: string; enabled: boolean; }
export interface MetaPageSelection { pageId: string; forms: { formId: string; name: string }[]; }

// ── Meta lead quality (Conversions API) ──────────────────────────────────────

export interface MetaConversionStats { pending: number; sent: number; failed: number; skipped: number; sentLast7Days: number; }

export interface MetaConversions {
  integrationId: string;
  enabled: boolean;
  datasetId: string | null;
  /** Whether a token is stored. The token itself is never sent to the browser. */
  hasToken: boolean;
  datasetName: string | null;
  lastVerifiedAt: string | null;
  sendDealValue: boolean;
  defaultCallingCode: string | null;
  /** Status / stage → event name in force. A blank name means nothing is sent for it. */
  leadEvents: Record<string, string>;
  dealEvents: Record<string, string>;
  defaultLeadEvents: Record<string, string>;
  defaultDealEvents: Record<string, string>;
  enabledAt: string | null;
  lastSentAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  stats: MetaConversionStats;
  /** Leads from this Meta connection that can be reported on. */
  metaLeads: number;
  leadEventSource: string;
}

export interface SaveMetaConversionsRequest {
  enabled: boolean;
  datasetId: string | null;
  /** Blank keeps the stored token. */
  accessToken?: string | null;
  sendDealValue: boolean;
  defaultCallingCode: string | null;
  leadEvents: Record<string, string>;
  dealEvents: Record<string, string>;
}

export interface MetaConversionEvent {
  id: string; leadId: string; leadName: string; dealId: string | null; eventName: string; eventTime: string;
  value: number | null; currency: string | null; status: "pending" | "sent" | "failed" | "skipped";
  attempts: number; nextAttemptAt: string | null; sentAt: string | null; lastError: string | null;
}

export interface MetaVerifyResult { ok: boolean; datasetName: string | null; message: string; }
export interface MetaTestResult { ok: boolean; message: string; }
export interface MetaCatchUpResult { leadsQueued: number; eventsQueued: number; alreadyTracked: number; outsideWindow: number; }

// ── API ────────────────────────────────────────────────────────────────────

export const integrationsApi = {
  getCatalog:  ()           => rawApiClient.get<ProviderCatalogItem[]>(`${BASE}/catalog`),
  getAll:      ()           => rawApiClient.get<Integration[]>(BASE),
  getById:     (id: string) => rawApiClient.get<Integration>(`${BASE}/${id}`),
  getSyncLogs: (id: string) => rawApiClient.get<SyncLog[]>(`${BASE}/${id}/sync-logs`),
  getInbox:    (id: string, status?: string) =>
    rawApiClient.get<RawLeadInboxEntry[]>(`${BASE}/${id}/inbox${status ? `?status=${status}` : ""}`),
  getSecret:   (id: string) => rawApiClient.get<IntegrationSecret>(`${BASE}/${id}/secret`),

  /** Tenant-wide inbound feed across every integration (the Lead Inbox page). */
  getLeadInbox: (f: LeadInboxFilters = {}) => {
    const q = new URLSearchParams();
    q.set("page", String(f.page ?? 1));
    q.set("pageSize", String(f.pageSize ?? 25));
    if (f.integrationId) q.set("integrationId", f.integrationId);
    // Only send a filter that is actually set: "all" is the absence of a filter, and sending it
    // as a value would have the server look for a provider literally named "all".
    if (f.provider && f.provider !== "all") q.set("provider", f.provider);
    if (f.status   && f.status   !== "all") q.set("status", f.status);
    if (f.search?.trim())                   q.set("search", f.search.trim());
    return rawApiClient.get<LeadInboxPage>(`${BASE}/inbox?${q}`);
  },
  getLeadInboxSummary: () => rawApiClient.get<LeadInboxSummary>(`${BASE}/inbox/summary`),

  previewAssignmentBackfill: (id: string, includeAssigned = false) =>
    rawApiClient.get<LeadAssignmentBackfillPreview>(
      `${BASE}/${id}/assignment-backfill?includeAssigned=${includeAssigned}`),
  applyAssignmentBackfill: (id: string, leadIds: string[]) =>
    rawApiClient.post<LeadAssignmentBackfillResult>(`${BASE}/${id}/assignment-backfill`, { leadIds }),
  getLeadInboxEntry:   (entryId: string) => rawApiClient.get<LeadInboxEntry>(`${BASE}/inbox/${entryId}`),
  retryLeadInboxEntry: (entryId: string) => rawApiClient.post<void>(`${BASE}/inbox/${entryId}/retry`, {}),

  create:       (providerKey: string, name?: string) =>
    rawApiClient.post<Integration>(BASE, { providerKey, name }),
  updateConfig: (id: string, req: UpdateConfigRequest) =>
    rawApiClient.put<void>(`${BASE}/${id}/config`, req),
  setApiKey:    (id: string, apiKey: string) =>
    rawApiClient.put<void>(`${BASE}/${id}/api-key`, { apiKey }),
  /** Import history from the provider. `since` is an ISO date; the server clamps it to the
   *  provider's own limit (Bayut serves six months) and says so in `note`. */
  backfill: (id: string, since: string): Promise<LeadBackfillResult> =>
    rawApiClient.post(`${BASE}/${id}/backfill`, { since }),
  /** Key for the third-party listing → agent lookup. Blank turns the lookup off. */
  setListingLookupKey: (id: string, apiKey: string, baseUrl?: string) =>
    rawApiClient.put<void>(`${BASE}/${id}/listing-lookup-key`, { apiKey, baseUrl }),
  /** Store a secret the PROVIDER issued (Bayut's Push key), not one we generated. */
  setSigningSecret: (id: string, secret: string) =>
    rawApiClient.put<void>(`${BASE}/${id}/signing-secret`, { secret }),
  rotateKey:    (id: string) => rawApiClient.post<Integration>(`${BASE}/${id}/rotate-key`),
  disconnect:   (id: string) => rawApiClient.post<void>(`${BASE}/${id}/disconnect`),
  remove:       (id: string) => rawApiClient.delete<void>(`${BASE}/${id}`),

  // Meta OAuth flow
  meta: {
    oauthStart: (id: string) => rawApiClient.post<{ url: string }>(`${BASE}/meta/${id}/oauth/start`),
    pages:      (id: string) => rawApiClient.get<MetaPage[]>(`${BASE}/meta/${id}/pages`),
    forms:      (id: string, pageId: string) =>
      rawApiClient.get<MetaForm[]>(`${BASE}/meta/${id}/forms?pageId=${encodeURIComponent(pageId)}`),
    select:     (id: string, pages: MetaPageSelection[]) =>
      rawApiClient.post<void>(`${BASE}/meta/${id}/select`, { pages }),

    /** Lead quality fed back to Meta so its ads learn which leads were good. */
    conversions: {
      get:         (id: string) => rawApiClient.get<MetaConversions>(`${BASE}/meta/${id}/conversions`),
      save:        (id: string, req: SaveMetaConversionsRequest) =>
        rawApiClient.put<MetaConversions>(`${BASE}/meta/${id}/conversions`, req),
      verify:      (id: string) => rawApiClient.post<MetaVerifyResult>(`${BASE}/meta/${id}/conversions/verify`, {}),
      test:        (id: string, testEventCode: string) =>
        rawApiClient.post<MetaTestResult>(`${BASE}/meta/${id}/conversions/test`, { testEventCode }),
      catchUp:     (id: string, days = 7) =>
        rawApiClient.post<MetaCatchUpResult>(`${BASE}/meta/${id}/conversions/catch-up`, { days }),
      retryFailed: (id: string) => rawApiClient.post<number>(`${BASE}/meta/${id}/conversions/retry-failed`, {}),
      events:      (id: string, status?: string) =>
        rawApiClient.get<MetaConversionEvent[]>(
          `${BASE}/meta/${id}/conversions/events?take=50${status ? `&status=${status}` : ""}`),
    },
  },
};
