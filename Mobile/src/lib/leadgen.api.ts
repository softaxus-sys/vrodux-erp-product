import { apiClient } from "@/lib/api-client";
import type { Tone } from "@/theme";

/**
 * Lead Generation (module `leadgen`) -- find businesses, reveal their contacts with credits, reach out by
 * email from the workspace's own mailbox, and answer replies. Trimmed mirror of the web client
 * (`FrontendVite/src/lib/leadgen/leadgen.api.ts`). Left on the web by design: connecting a mailbox
 * (OAuth), the campaign builder, buying credits (Billing), suppression lists and the super-admin console.
 */
const BASE = "/api/leadgen";

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Permissions (mirror the controllers' [RequirePermission]) ───────────────────────────────────
export const LG_PROSPECTS_VIEW = ["leadgen.prospects.view"];
export const LG_PROSPECTS_EDIT = ["leadgen.prospects.edit"];
export const LG_PROSPECTS_REVEAL = ["leadgen.prospects.reveal"];
export const LG_PROSPECTS_IMPORT = ["leadgen.prospects.import"];
export const LG_SEARCHES_VIEW = ["leadgen.searches.view"];
export const LG_SEARCHES_CREATE = ["leadgen.searches.create"];
export const LG_CAMPAIGNS_VIEW = ["leadgen.campaigns.view"];
export const LG_CAMPAIGNS_SEND = ["leadgen.campaigns.send", "leadgen.campaigns.edit"];
export const LG_INBOX_VIEW = ["leadgen.inbox.view"];
export const LG_INBOX_SEND = ["leadgen.inbox.send"];
export const LG_INBOX_EDIT = ["leadgen.inbox.edit"];
export const LG_CREDITS_VIEW = ["leadgen.credits.view"];
export const LG_MAILBOXES_VIEW = ["leadgen.mailboxes.view"];
export const LG_MAILBOXES_EDIT = ["leadgen.mailboxes.edit"];
export const LG_REPORTS_VIEW = ["leadgen.reports.view"];
export const LEADGEN_ANY_VIEW = [
  ...LG_PROSPECTS_VIEW, ...LG_SEARCHES_VIEW, ...LG_CAMPAIGNS_VIEW, ...LG_INBOX_VIEW, ...LG_CREDITS_VIEW, ...LG_MAILBOXES_VIEW, ...LG_REPORTS_VIEW,
];

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

// ── Setup ───────────────────────────────────────────────────────────────────────────────────────
export interface RegionDto { name: string; nameAr: string; areas: string[] }
export interface CountryDto { code: string; name: string; live: boolean; allowed: boolean; complianceNote: string; regions: RegionDto[] }
export interface CategoryDto { key: string; label: string; group: string }
export interface LimitsDto {
  revealCost: number; verifiedEmailBonus: number; maxResultsPerSearch: number; maxRevealsPerRequest: number;
  dailySearchLimit: number; searchesToday: number; dailyDiscoveryLimit: number; discoveredToday: number;
  bounceRefundDays: number;
}
export interface MetaDto {
  enabled: boolean; providerConfigured: boolean; defaultCountry: string; countries: CountryDto[]; categories: CategoryDto[];
  limits: LimitsDto; balance: number; canSend: boolean; sendBlockReason: string | null;
}

// ── Searches ────────────────────────────────────────────────────────────────────────────────────
export interface SearchInput {
  name: string; countryCode: string; regions: string[]; areas?: string[]; categories: string[];
  keywords?: string | null; maxResults: number;
}
export type SearchStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export interface SearchDto {
  id: string; name: string; countryCode: string; regions: string[]; categories: string[]; maxResults: number;
  status: SearchStatus; error: string | null; foundCount: number; newCount: number; duplicateCount: number;
  revealedCount: number; progress: string | null; createdAt: string;
}
export interface SearchEstimateDto {
  plannedQueries: number; maxResults: number; searchesLeftToday: number; discoveryLeftToday: number;
  providerConfigured: boolean; warnings: string[];
}
export const isSearchActive = (s: { status: string }) => s.status === "queued" || s.status === "running";

// ── Prospects ───────────────────────────────────────────────────────────────────────────────────
export type ProspectStatus =
  "discovered" | "revealed" | "contacted" | "replied" | "qualified" | "converted" | "rejected" | "do_not_contact";
export const PROSPECT_STATUSES: ProspectStatus[] =
  ["discovered", "revealed", "contacted", "replied", "qualified", "converted", "rejected", "do_not_contact"];
export const MANUAL_STATUSES: ProspectStatus[] = ["revealed", "contacted", "replied", "qualified", "rejected", "do_not_contact"];

export interface ContactDto { id: string; fullName: string; title: string | null; email: string | null; emailStatus: string; phone: string | null }
export interface ProspectDto {
  id: string; name: string; categoryLabel: string | null; countryCode: string; region: string | null; city: string | null;
  area: string | null; address: string | null; rating: number | null; reviewCount: number | null; googleMapsUri: string | null;
  isRevealed: boolean; status: ProspectStatus; qualityScore: number; fitScore: number; scoreNotes: string[];
  hasPhone: boolean; hasWebsite: boolean; hasEmail: boolean | null;
  phone: string | null; website: string | null; email: string | null; emailStatus: string;
  ownerName: string | null; crmLeadId: string | null; notes: string | null; suppressed: boolean;
  contacts: ContactDto[] | null;
}
export interface ProspectFilter {
  search?: string; searchId?: string; status?: string; page?: number; pageSize?: number; sort?: string;
}
export interface ProspectStatsDto {
  total: number; discovered: number; revealed: number; contacted: number; replied: number; qualified: number;
  converted: number; rejected: number; doNotContact: number; inCrm: number;
}
export interface RevealItemDto { id: string; outcome: "revealed" | "refunded" | "skipped" | "not_found" | "insufficient_credits"; credits: number; message: string | null }
export interface RevealResultDto { revealed: number; refunded: number; skipped: number; creditsSpent: number; balance: number; items: RevealItemDto[] }
export interface ImportToCrmResult { created: number; duplicates: number; failed: number; notRevealed: number; errors: string[] }

// ── Credits ─────────────────────────────────────────────────────────────────────────────────────
export interface WalletDto { balance: number; lifetimePurchased: number; lifetimeSpent: number; lifetimeRefunded: number; revealCost: number; verifiedEmailBonus: number }
export interface LedgerEntryDto {
  id: string; type: "grant" | "purchase" | "spend" | "refund" | "adjustment"; amount: number; balanceAfter: number;
  reason: string; actorName: string | null; createdAt: string;
}

// ── Mailboxes ───────────────────────────────────────────────────────────────────────────────────
export interface MailboxDto {
  id: string; provider: string; address: string; displayName: string | null;
  status: "connected" | "error" | "paused" | "disconnected"; statusReason: string | null;
  dailyLimit: number; todayLimit: number; sentToday: number; remainingToday: number; warmupDay: number;
  totalSent: number; totalBounced: number; totalReplies: number; bounceRatePercent: number; lastError: string | null;
}

// ── Campaigns ───────────────────────────────────────────────────────────────────────────────────
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "stopped";
export interface StepDto { id: string; number: number; delayDays: number; subject: string; body: string }
export interface CampaignCountsDto {
  total: number; pending: number; active: number; completed: number; replied: number; bounced: number;
  unsubscribed: number; stopped: number; failed: number; skipped: number;
}
export interface CampaignDto {
  id: string; name: string; mailboxAddress: string | null; status: CampaignStatus; pauseReason: string | null;
  timeZoneId: string; windowStart: string; windowEnd: string; dailyCap: number; steps: StepDto[];
  counts: CampaignCountsDto; sent: number; replies: number; replyRatePercent: number; bounceRatePercent: number;
}

// ── Inbox ───────────────────────────────────────────────────────────────────────────────────────
export type ThreadClass = "none" | "interested" | "not_interested" | "out_of_office" | "unsubscribe" | "bounce" | "question";
export const THREAD_CLASSES: ThreadClass[] = ["none", "interested", "question", "not_interested", "out_of_office", "unsubscribe"];
export interface ThreadDto {
  id: string; mailboxAddress: string | null; prospectName: string | null; campaignName: string | null; counterparty: string;
  subject: string; classification: ThreadClass; messageCount: number; unreadCount: number; hasReply: boolean;
  isArchived: boolean; lastMessageAt: string; snippet: string | null;
}
export interface MessageDto {
  id: string; direction: "in" | "out"; status: string; from: string; to: string; subject: string;
  bodyText: string | null; occurredAt: string; error: string | null;
}
export interface ThreadDetailDto { thread: ThreadDto; messages: MessageDto[] }
export interface ThreadFilter { unread?: boolean; repliesOnly?: boolean; archived?: boolean; search?: string; page?: number; pageSize?: number }
export interface InboxCountsDto { unread: number; replies: number; needsAttention: number }

// ── Dashboard ───────────────────────────────────────────────────────────────────────────────────
export interface DashboardDto {
  balance: number; days: number;
  funnel: { discovered: number; revealed: number; contacted: number; replied: number; qualified: number; converted: number };
  sent: number; replies: number; bounces: number; interested: number; replyRatePercent: number; bounceRatePercent: number;
  creditsSpent: number; activeCampaigns: number; unreadReplies: number; connectedMailboxes: number; pausedMailboxes: number;
  attention: string[];
}

export const leadgenApi = {
  getMeta: () => apiClient.get<MetaDto>(`${BASE}/meta`),
  getDashboard: (days = 30) => apiClient.get<DashboardDto>(`${BASE}/dashboard${qs({ days })}`),

  getSearches: () => apiClient.get<SearchDto[]>(`${BASE}/searches`),
  estimateSearch: (r: SearchInput) => apiClient.post<SearchEstimateDto>(`${BASE}/searches/estimate`, r),
  createSearch: (r: SearchInput) => apiClient.post<SearchDto>(`${BASE}/searches`, r),
  cancelSearch: (id: string) => apiClient.post<void>(`${BASE}/searches/${id}/cancel`),

  getProspects: (f: ProspectFilter = {}) => apiClient.get<Paged<ProspectDto>>(`${BASE}/prospects${qs({ ...f })}`),
  getProspectStats: (searchId?: string) => apiClient.get<ProspectStatsDto>(`${BASE}/prospects/stats${qs({ searchId })}`),
  getProspect: (id: string) => apiClient.get<ProspectDto>(`${BASE}/prospects/${id}`),
  updateProspect: (id: string, r: { status?: string; notes?: string }) =>
    apiClient.patch<ProspectDto>(`${BASE}/prospects/${id}`, { clearOwner: false, ...r }),
  revealProspects: (ids: string[]) => apiClient.post<RevealResultDto>(`${BASE}/prospects/reveal`, { ids }),
  importToCrm: (ids: string[]) => apiClient.post<ImportToCrmResult>(`${BASE}/prospects/import-to-crm`, { ids }),

  getWallet: () => apiClient.get<WalletDto>(`${BASE}/credits/wallet`),
  getLedger: (p: { page?: number; pageSize?: number } = {}) => apiClient.get<Paged<LedgerEntryDto>>(`${BASE}/credits/ledger${qs(p)}`),

  getMailboxes: () => apiClient.get<MailboxDto[]>(`${BASE}/mailboxes`),
  pauseMailbox: (id: string) => apiClient.post<void>(`${BASE}/mailboxes/${id}/pause`),
  resumeMailbox: (id: string) => apiClient.post<void>(`${BASE}/mailboxes/${id}/resume`),
  syncMailbox: (id: string) => apiClient.post<{ received: number; replies: number; bounces: number }>(`${BASE}/mailboxes/${id}/sync`),

  getCampaigns: () => apiClient.get<CampaignDto[]>(`${BASE}/campaigns`),
  getCampaign: (id: string) => apiClient.get<CampaignDto>(`${BASE}/campaigns/${id}`),
  startCampaign: (id: string) => apiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/start`),
  pauseCampaign: (id: string) => apiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/pause`),
  stopCampaign: (id: string) => apiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/stop`),

  getThreads: (f: ThreadFilter = {}) => apiClient.get<Paged<ThreadDto>>(`${BASE}/inbox/threads${qs({ ...f })}`),
  getThread: (id: string) => apiClient.get<ThreadDetailDto>(`${BASE}/inbox/threads/${id}`),
  getInboxCounts: () => apiClient.get<InboxCountsDto>(`${BASE}/inbox/counts`),
  reply: (id: string, body: string) => apiClient.post<MessageDto>(`${BASE}/inbox/threads/${id}/reply`, { body }),
  updateThread: (id: string, r: { classification?: string; archived?: boolean; markRead?: boolean }) =>
    apiClient.patch<ThreadDto>(`${BASE}/inbox/threads/${id}`, { clearAssignee: false, ...r }),
};

// ── Presentation ────────────────────────────────────────────────────────────────────────────────
const TONES: Record<string, Tone> = {
  discovered: "neutral", revealed: "info", contacted: "primary", replied: "success", qualified: "warning", converted: "success",
  rejected: "neutral", do_not_contact: "destructive",
  queued: "neutral", running: "info", completed: "success", failed: "destructive", cancelled: "neutral",
  draft: "neutral", active: "success", paused: "warning", stopped: "neutral",
  connected: "success", error: "destructive", disconnected: "neutral",
  interested: "success", question: "info", not_interested: "neutral", out_of_office: "neutral", unsubscribe: "destructive", bounce: "destructive", none: "neutral",
};
/** Never index a status map bare -- an unknown value must not crash a screen. */
export const lgTone = (s: string): Tone => TONES[s] ?? "neutral";
export const lgLabel = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const scoreTone = (n: number): Tone => (n >= 70 ? "success" : n >= 40 ? "warning" : "neutral");
