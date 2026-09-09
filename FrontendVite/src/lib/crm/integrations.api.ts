import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/crm/integrations`;

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

export interface FieldMappingInput { sourceField: string; targetField: string; }
export interface UpdateConfigRequest {
  config?: string | null; dedupeConfig?: string | null;
  routingConfig?: string | null; fieldMappings?: FieldMappingInput[];
}

// ── Meta ─────────────────────────────────────────────────────────────────────
export interface MetaPage { pageId: string; name: string; enabled: boolean; }
export interface MetaForm { formId: string; name: string; enabled: boolean; }
export interface MetaPageSelection { pageId: string; forms: { formId: string; name: string }[]; }

// ── API ────────────────────────────────────────────────────────────────────

export const integrationsApi = {
  getCatalog:  ()           => rawApiClient.get<ProviderCatalogItem[]>(`${BASE}/catalog`),
  getAll:      ()           => rawApiClient.get<Integration[]>(BASE),
  getById:     (id: string) => rawApiClient.get<Integration>(`${BASE}/${id}`),
  getSyncLogs: (id: string) => rawApiClient.get<SyncLog[]>(`${BASE}/${id}/sync-logs`),
  getInbox:    (id: string, status?: string) =>
    rawApiClient.get<RawLeadInboxEntry[]>(`${BASE}/${id}/inbox${status ? `?status=${status}` : ""}`),
  getSecret:   (id: string) => rawApiClient.get<IntegrationSecret>(`${BASE}/${id}/secret`),

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
  },
};
