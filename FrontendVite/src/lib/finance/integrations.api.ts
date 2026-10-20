import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/finance/integrations`;

/** native = Finance posts it itself · queue = collected and posted from the queue ·
 *  client = a user creates the Finance document from another screen · none = nothing posts. */
export type IntegrationKind = "native" | "queue" | "client" | "none";
export type IntegrationHealth = "connected" | "attention" | "partial" | "off" | "not_connected";
export type IntegrationMode = "off" | "review" | "auto";
export type PostingStatus = "pending" | "posting" | "posted" | "failed" | "skipped" | "reversed";

export interface IntegrationRoleDto {
  role: string;
  label: string;
  side: "debit" | "credit";
  defaultAccountNumber: string;
  accountId: string | null;
  accountNumber: string | null;
  accountName: string | null;
  isMapped: boolean;
  isResolved: boolean;
  isActive: boolean;
}

export interface QueueCountsDto {
  pending: number;
  posted: number;
  failed: number;
  skipped: number;
  reversed: number;
}

export interface IntegrationDto {
  key: string;
  module: string;
  name: string;
  kind: IntegrationKind;
  trigger: string;
  notes: string;
  health: IntegrationHealth;
  issues: string[];
  mode: IntegrationMode | null;
  startDate: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  queue: QueueCountsDto | null;
  sourceDocuments: number | null;
  linkedDocuments: number | null;
  sourceError: string | null;
  roles: IntegrationRoleDto[];
  /** Documents above this (ledger currency) need high-value approval and are never posted automatically. */
  approvalLimit: number | null;
  /** The person who submits a document cannot be the one who posts it. */
  requireSeparateApprover: boolean;
  /** False: always posted by a person, whatever the mode says. */
  autoAllowed: boolean;
}

export interface IntegrationOverviewDto {
  integrations: IntegrationDto[];
  connected: number;
  needAttention: number;
  partial: number;
  notConnected: number;
  pendingItems: number;
  failedItems: number;
  ledgerCurrency: string;
}

export interface PostingItemDto {
  id: string;
  integrationKey: string;
  integrationName: string;
  sourceModule: string;
  sourceId: string;
  sourceNumber: string;
  sourceDate: string;
  description: string;
  currencyCode: string;
  totalAmount: number;
  status: PostingStatus;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  journalEntryId: string | null;
  journalEntryNumber: string | null;
  postedAt: string | null;
  postedByName: string | null;
  createdAt: string;
  submittedAt: string | null;
  submittedByName: string | null;
}

export interface PostingItemPageDto {
  items: PostingItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PreviewLineDto {
  role: string;
  roleLabel: string;
  accountId: string | null;
  accountNumber: string | null;
  accountName: string | null;
  debit: number;
  credit: number;
}

export interface PostingPreviewDto {
  item: PostingItemDto;
  lines: PreviewLineDto[];
  totalDebit: number;
  totalCredit: number;
  rate: number;
  ledgerCurrency: string;
  periodClosed: boolean;
  canPost: boolean;
  problems: string[];
  sourceAmounts: Record<string, number>;
}

export interface PostResultDto {
  posted: number;
  failed: number;
  unchanged: number;
  items: { itemId: string; status: PostingStatus | "refused"; error: string | null; journalEntryNumber: string | null }[];
}

export interface SyncResultDto {
  collected: number;
  posted: number;
  failed: number;
  integrations: { integrationKey: string; collected: number; posted: number; failed: number; error: string | null }[];
}

export interface PostingCheckItemDto {
  itemId: string;
  integrationKey: string;
  sourceNumber: string;
  sourceDate: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  canPost: boolean;
  problems: string[];
}

/** Totals and accounts cover the ready documents only — what posting would write. */
export interface PostingCheckDto {
  items: number;
  ready: number;
  blocked: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  ledgerCurrency: string;
  accounts: { accountNumber: string; accountName: string; debit: number; credit: number }[];
  results: PostingCheckItemDto[];
}

export interface AutoReadinessDto {
  integrationKey: string;
  ready: boolean;
  blockers: string[];
  pendingItems: number;
  pendingAmount: number;
  failedItems: number;
  uncollectedDocuments: number | null;
  documentCurrency: string;
  intervalMinutes: number;
}

export interface SubmitResultDto {
  changed: number;
  unchanged: number;
  problems: string[];
}

export interface PostingQueueParams {
  module?: string;
  integrationKey?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const integrationsApi = {
  getOverview: (module?: string): Promise<IntegrationOverviewDto> =>
    rawApiClient.get(module ? `${BASE}?module=${encodeURIComponent(module)}` : BASE),

  getAutoReadiness: (key: string, startDate?: string | null): Promise<AutoReadinessDto> =>
    rawApiClient.get(`${BASE}/${key}/auto-readiness${startDate ? `?startDate=${startDate}` : ""}`),

  check: (ids: string[]): Promise<PostingCheckDto> => rawApiClient.post(`${BASE}/queue/check`, { ids }),

  updateSetting: (key: string, body: { mode: IntegrationMode; startDate?: string | null; acknowledgeAuto?: boolean }): Promise<void> =>
    rawApiClient.put(`${BASE}/${key}/setting`, body),

  saveMappings: (key: string, mappings: { role: string; accountId: string | null }[]): Promise<void> =>
    rawApiClient.put(`${BASE}/${key}/mappings`, { mappings }),

  sync: (integrationKey?: string): Promise<SyncResultDto> =>
    rawApiClient.post(`${BASE}/sync`, { integrationKey: integrationKey ?? null }),

  getQueue: (params: PostingQueueParams): Promise<PostingItemPageDto> => {
    const q = new URLSearchParams();
    if (params.module) q.set("module", params.module);
    if (params.integrationKey) q.set("integrationKey", params.integrationKey);
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    q.set("page", String(params.page ?? 1));
    q.set("pageSize", String(params.pageSize ?? 50));
    return rawApiClient.get(`${BASE}/queue?${q}`);
  },

  submit: (ids: string[], withdraw = false): Promise<SubmitResultDto> =>
    rawApiClient.post(`${BASE}/queue/submit`, { ids, withdraw }),

  updateApproval: (key: string, body: { approvalLimit: number | null; requireSeparateApprover: boolean }): Promise<void> =>
    rawApiClient.put(`${BASE}/${key}/approval`, body),

  getPreview: (id: string): Promise<PostingPreviewDto> => rawApiClient.get(`${BASE}/queue/${id}/preview`),

  /** controlTotal is the debit total the user was shown; the server posts nothing if it no longer holds. */
  post: (ids: string[], controlTotal?: number): Promise<PostResultDto> =>
    rawApiClient.post(`${BASE}/queue/post`, { ids, controlTotal: controlTotal ?? null }),

  retryFailed: (integrationKey?: string): Promise<PostResultDto> =>
    rawApiClient.post(`${BASE}/queue/retry-failed`, { integrationKey: integrationKey ?? null }),

  skip: (id: string, reason?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/queue/${id}/skip`, { reason: reason ?? null }),

  requeue: (id: string): Promise<void> => rawApiClient.post(`${BASE}/queue/${id}/requeue`),

  reverse: (id: string, reason: string): Promise<void> => rawApiClient.post(`${BASE}/queue/${id}/reverse`, { reason }),
};
