import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/leadgen`;
const ADMIN = `${getApiBaseUrl()}/api/admin/leadgen`;

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; }

// ── Setup ───────────────────────────────────────────────────────────────────

export interface RegionDto { name: string; nameAr: string; areas: string[]; }
export interface CountryDto {
  code: string; name: string; nameAr: string; live: boolean; allowed: boolean; complianceNote: string;
  timezone: string; workingDays: string[]; regions: RegionDto[];
}
export interface CategoryDto { key: string; label: string; labelAr: string; group: string; }

export interface LimitsDto {
  revealCost: number; verifiedEmailBonus: number; maxResultsPerSearch: number; maxRevealsPerRequest: number;
  dailySearchLimit: number; searchesToday: number; dailyDiscoveryLimit: number; discoveredToday: number;
  maxMailboxes: number; maxDailySendsPerMailbox: number; maxDailySendsPerWorkspace: number; sentToday: number;
  bounceRefundDays: number;
}

export interface MetaDto {
  enabled: boolean; providerConfigured: boolean; emailVerifierConfigured: boolean; defaultCountry: string;
  countries: CountryDto[]; categories: CategoryDto[]; limits: LimitsDto; balance: number;
  canSend: boolean; sendBlockReason: string | null; senderIdentityReady: boolean;
}

export interface ProfileDto {
  offerSummary: string | null; targetCustomers: string | null; dealSize: string | null; countryCode: string;
  preferredRegions: string[]; preferredCategories: string[]; excludeKeywords: string | null;
  senderBusinessName: string | null; senderAddress: string | null; senderWebsite: string | null;
}
export interface ProfileInput {
  offerSummary?: string | null; targetCustomers?: string | null; dealSize?: string | null; countryCode: string;
  preferredRegions?: string[]; preferredCategories?: string[]; excludeKeywords?: string | null;
  senderBusinessName?: string | null; senderAddress?: string | null; senderWebsite?: string | null;
}

export interface SuppressionDto { id: string; kind: string; value: string; reason: string; source: string | null; createdAt: string; }

// ── Searches ────────────────────────────────────────────────────────────────

export interface SearchInput {
  name: string; countryCode: string; regions: string[]; areas?: string[]; categories: string[];
  keywords?: string | null; maxResults: number;
}
export interface SearchDto {
  id: string; name: string; countryCode: string; regions: string[]; areas: string[]; categories: string[];
  keywords: string | null; maxResults: number; status: "queued" | "running" | "completed" | "failed" | "cancelled";
  error: string | null; foundCount: number; newCount: number; duplicateCount: number; revealedCount: number;
  progress: string | null; createdByName: string | null; createdAt: string; startedAt: string | null; completedAt: string | null;
}
export interface SearchEstimateDto {
  plannedQueries: number; maxResults: number; searchesLeftToday: number; discoveryLeftToday: number;
  providerConfigured: boolean; warnings: string[];
}
export const isSearchActive = (s: { status: string }) => s.status === "queued" || s.status === "running";

// ── Prospects ───────────────────────────────────────────────────────────────

export type ProspectStatus =
  "discovered" | "revealed" | "contacted" | "replied" | "qualified" | "converted" | "rejected" | "do_not_contact";
export const PROSPECT_STATUSES: ProspectStatus[] =
  ["discovered", "revealed", "contacted", "replied", "qualified", "converted", "rejected", "do_not_contact"];
/** Statuses a person may set by hand (the rest are set by the system). */
export const MANUAL_STATUSES: ProspectStatus[] = ["revealed", "contacted", "replied", "qualified", "rejected", "do_not_contact"];

export interface ContactDto { id: string; fullName: string; title: string | null; email: string | null; emailStatus: string; phone: string | null; source: string; }

export interface ProspectDto {
  id: string; searchJobId: string | null; name: string; category: string | null; categoryLabel: string | null;
  countryCode: string; region: string | null; city: string | null; area: string | null; address: string | null;
  rating: number | null; reviewCount: number | null; businessStatus: string | null; googleMapsUri: string | null;
  isRevealed: boolean; status: ProspectStatus; qualityScore: number; fitScore: number; scoreNotes: string[];
  hasPhone: boolean; hasWebsite: boolean; hasEmail: boolean | null;
  phone: string | null; phoneType: string | null; website: string | null; email: string | null; emailStatus: string;
  emailIsRole: boolean; social: Record<string, string> | null;
  ownerUserId: string | null; ownerName: string | null; crmLeadId: string | null; notes: string | null; suppressed: boolean;
  revealedAt: string | null; lastVerifiedAt: string | null; createdAt: string; contacts: ContactDto[] | null;
}

export interface ProspectFilter {
  search?: string; searchId?: string; status?: string; revealed?: boolean; minQuality?: number; minFit?: number;
  region?: string; category?: string; hasEmail?: boolean; ownerId?: string; inCrm?: boolean; sort?: string;
  page?: number; pageSize?: number;
}
export interface ProspectStatsDto {
  total: number; discovered: number; revealed: number; contacted: number; replied: number; qualified: number;
  converted: number; rejected: number; doNotContact: number; inCrm: number;
}
export interface RevealItemDto { id: string; outcome: "revealed" | "refunded" | "skipped" | "not_found" | "insufficient_credits"; credits: number; message: string | null; }
export interface RevealResultDto { revealed: number; refunded: number; skipped: number; creditsSpent: number; balance: number; items: RevealItemDto[]; }
export interface ImportToCrmResult { created: number; duplicates: number; failed: number; notRevealed: number; errors: string[]; }
export interface CreateProspectInput {
  name: string; category?: string | null; countryCode: string; region?: string | null; city?: string | null;
  address?: string | null; phone?: string | null; email?: string | null; website?: string | null; notes?: string | null;
}

// ── Credits ─────────────────────────────────────────────────────────────────

export interface WalletDto {
  balance: number; lifetimePurchased: number; lifetimeSpent: number; lifetimeRefunded: number; lowBalanceAlert: number | null;
  trialGranted: boolean; revealCost: number; verifiedEmailBonus: number;
}
export interface LedgerEntryDto {
  id: string; type: "grant" | "purchase" | "spend" | "refund" | "adjustment"; amount: number; balanceAfter: number;
  reason: string; refType: string | null; refId: string | null; actorName: string | null; createdAt: string;
}
export interface PackDto { id: string; name: string; credits: number; priceMinor: number; currency: string; badge: string | null; isActive: boolean; sortOrder: number; }
export interface PurchaseDto {
  id: string; packName: string; credits: number; amountMinor: number; currency: string; provider: string;
  status: "pending" | "paid" | "failed" | "expired"; failureReason: string | null; createdByName: string | null; createdAt: string; paidAt: string | null;
}
export interface CheckoutDto { purchaseId: string; url: string; }
export interface PaymentOptionsDto { stripe: boolean; payPal: boolean; }

// ── Mailboxes ───────────────────────────────────────────────────────────────

export type MailboxProvider = "google" | "microsoft" | "imap";
export interface MailboxDto {
  id: string; provider: MailboxProvider; address: string; displayName: string | null;
  status: "connected" | "error" | "paused" | "disconnected"; statusReason: string | null;
  dailyLimit: number; todayLimit: number; sentToday: number; remainingToday: number; warmupDay: number;
  totalSent: number; totalBounced: number; totalReplies: number; bounceRatePercent: number;
  lastSyncAt: string | null; lastSentAt: string | null; lastError: string | null; signatureText: string | null;
  ownerUserId: string; createdAt: string;
}
export interface MailboxProvidersDto { google: boolean; microsoft: boolean; imap: boolean; }
export interface ConnectImapInput {
  address: string; displayName?: string | null; username: string; password: string;
  smtpHost: string; smtpPort: number; imapHost: string; imapPort: number;
}

// ── Campaigns ───────────────────────────────────────────────────────────────

export interface StepDto { id: string; number: number; delayDays: number; subject: string; body: string; }
export interface StepInput { delayDays: number; subject: string; body: string; }
export interface CampaignCountsDto {
  total: number; pending: number; active: number; completed: number; replied: number; bounced: number;
  unsubscribed: number; stopped: number; failed: number; skipped: number;
}
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "stopped";
export interface CampaignDto {
  id: string; name: string; mailboxId: string; mailboxAddress: string | null; status: CampaignStatus; pauseReason: string | null;
  timeZoneId: string; windowStart: string; windowEnd: string; sendDays: string; dailyCap: number; stopOnReply: boolean;
  steps: StepDto[]; counts: CampaignCountsDto; sent: number; replies: number; replyRatePercent: number; bounceRatePercent: number;
  createdByName: string | null; createdAt: string; startedAt: string | null;
}
export interface CampaignInput {
  name: string; mailboxId: string; timeZoneId: string; windowStart: string; windowEnd: string; sendDays: string;
  dailyCap: number; stopOnReply: boolean; steps: StepInput[];
}
export interface RecipientDto {
  id: string; prospectId: string; prospectName: string; email: string; status: string; currentStep: number;
  nextSendAt: string | null; lastSentAt: string | null; lastError: string | null; threadId: string | null;
}
export interface AddRecipientsResult { added: number; noEmail: number; notSendable: number; suppressed: number; duplicate: number; notRevealed: number; }
export interface PreviewDto { subject: string; body: string; to: string; warnings: string[]; }

/** Merge fields a template may use — must match the backend's allow-list. */
export const MERGE_FIELDS = ["business_name", "category", "area", "city", "region", "website", "sender_name", "sender_business"] as const;

// ── Inbox ───────────────────────────────────────────────────────────────────

export type ThreadClass = "none" | "interested" | "not_interested" | "out_of_office" | "unsubscribe" | "bounce" | "question";
export const THREAD_CLASSES: ThreadClass[] = ["none", "interested", "question", "not_interested", "out_of_office", "unsubscribe"];
export interface ThreadDto {
  id: string; mailboxId: string; mailboxAddress: string | null; prospectId: string | null; prospectName: string | null;
  campaignId: string | null; campaignName: string | null; counterparty: string; subject: string; classification: ThreadClass;
  messageCount: number; unreadCount: number; hasReply: boolean; assignedUserId: string | null; assignedName: string | null;
  isArchived: boolean; lastMessageAt: string; snippet: string | null;
}
export interface MessageDto {
  id: string; direction: "in" | "out"; status: string; from: string; to: string; cc: string | null; subject: string;
  bodyText: string | null; occurredAt: string; isRead: boolean; error: string | null; stepNumber: number | null;
}
export interface ThreadDetailDto { thread: ThreadDto; messages: MessageDto[]; }
export interface ThreadFilter {
  mailboxId?: string; classification?: string; unread?: boolean; mine?: boolean; archived?: boolean; repliesOnly?: boolean;
  search?: string; page?: number; pageSize?: number;
}
export interface InboxCountsDto { unread: number; replies: number; needsAttention: number; }

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardDto {
  balance: number; days: number;
  funnel: { discovered: number; revealed: number; contacted: number; replied: number; qualified: number; converted: number };
  sent: number; replies: number; bounces: number; interested: number; replyRatePercent: number; bounceRatePercent: number;
  creditsSpent: number; creditsRefunded: number; activeCampaigns: number; unreadReplies: number;
  connectedMailboxes: number; pausedMailboxes: number;
  series: { date: string; sent: number; replies: number; bounces: number }[];
  campaigns: { id: string; name: string; status: string; recipients: number; sent: number; replies: number; replyRatePercent: number; bounced: number; interested: number }[];
  sources: { searchId: string; name: string; found: number; revealed: number; replied: number; converted: number; creditsSpent: number; costPerReply: number }[];
  attention: string[];
}

// ── Platform admin ──────────────────────────────────────────────────────────

export interface PackInput { name: string; credits: number; priceMinor: number; currency: string; sortOrder: number; badge?: string | null; isActive: boolean; }
export interface PlatformSettingsDto {
  enabled: boolean; revealCost: number; verifiedEmailBonus: number; trialGrantCredits: number; dailySearchLimit: number;
  dailyDiscoveryLimit: number; maxResultsPerSearch: number; maxRevealsPerRequest: number; poolFreshDays: number;
  bounceRefundDays: number; allowedCountries: string[]; requireSenderIdentity: boolean; maxMailboxesPerWorkspace: number;
  maxDailySendsPerMailbox: number; maxDailySendsPerWorkspace: number; bounceRatePauseBp: number; complaintRatePauseBp: number;
  blockSendingOnTrial: boolean;
}
export interface AdminTenantUsageDto {
  tenantId: string; tenantName: string | null; balance: number; lifetimePurchased: number; lifetimeSpent: number;
  searches: number; prospects: number; revealed: number; mailboxes: number; campaigns: number; sent30d: number;
  bounced30d: number; lastActivityAt: string | null;
}
export interface AdminOverviewDto {
  workspaces: number; creditsOutstanding: number; creditsSold: number; creditsSpent: number; providersRequests30d: number;
  sent30d: number; bounced30d: number; replies30d: number; pausedMailboxes: number; poolSize: number; poolEnriched: number;
  top: AdminTenantUsageDto[];
}

// ── The client ──────────────────────────────────────────────────────────────

export const leadgenApi = {
  getMeta: () => rawApiClient.get<MetaDto>(`${BASE}/meta`),
  getProfile: () => rawApiClient.get<ProfileDto>(`${BASE}/profile`),
  updateProfile: (r: ProfileInput) => rawApiClient.put<ProfileDto>(`${BASE}/profile`, r),
  getDashboard: (days = 30) => rawApiClient.get<DashboardDto>(`${BASE}/dashboard${qs({ days })}`),

  getSuppressions: (p: { search?: string; page?: number; pageSize?: number } = {}) =>
    rawApiClient.get<Paged<SuppressionDto>>(`${BASE}/suppressions${qs(p)}`),
  addSuppression: (kind: string, value: string, reason?: string) => rawApiClient.post<SuppressionDto>(`${BASE}/suppressions`, { kind, value, reason }),
  importSuppressions: (values: string[]) => rawApiClient.post<{ added: number; skipped: number }>(`${BASE}/suppressions/import`, { values }),
  removeSuppression: (id: string) => rawApiClient.delete<void>(`${BASE}/suppressions/${id}`),

  getSearches: () => rawApiClient.get<SearchDto[]>(`${BASE}/searches`),
  getSearch: (id: string) => rawApiClient.get<SearchDto>(`${BASE}/searches/${id}`),
  estimateSearch: (r: SearchInput) => rawApiClient.post<SearchEstimateDto>(`${BASE}/searches/estimate`, r),
  createSearch: (r: SearchInput) => rawApiClient.post<SearchDto>(`${BASE}/searches`, r),
  cancelSearch: (id: string) => rawApiClient.post<void>(`${BASE}/searches/${id}/cancel`),
  deleteSearch: (id: string, deleteUnrevealed = true) => rawApiClient.delete<void>(`${BASE}/searches/${id}${qs({ deleteUnrevealed })}`),

  getProspects: (f: ProspectFilter = {}) => rawApiClient.get<Paged<ProspectDto>>(`${BASE}/prospects${qs({ ...f })}`),
  getProspectStats: (searchId?: string) => rawApiClient.get<ProspectStatsDto>(`${BASE}/prospects/stats${qs({ searchId })}`),
  getProspect: (id: string) => rawApiClient.get<ProspectDto>(`${BASE}/prospects/${id}`),
  createProspect: (r: CreateProspectInput) => rawApiClient.post<ProspectDto>(`${BASE}/prospects`, r),
  updateProspect: (id: string, r: { status?: string; notes?: string; ownerUserId?: string; ownerName?: string; clearOwner?: boolean }) =>
    rawApiClient.patch<ProspectDto>(`${BASE}/prospects/${id}`, { clearOwner: false, ...r }),
  bulkProspects: (r: { ids: string[]; action: "delete" | "assign" | "status"; status?: string; ownerUserId?: string | null; ownerName?: string | null }) =>
    rawApiClient.post<{ affected: number; skipped: number }>(`${BASE}/prospects/bulk`, r),
  revealProspects: (ids: string[]) => rawApiClient.post<RevealResultDto>(`${BASE}/prospects/reveal`, { ids }),
  importToCrm: (ids: string[]) => rawApiClient.post<ImportToCrmResult>(`${BASE}/prospects/import-to-crm`, { ids }),
  addContact: (id: string, r: { fullName: string; title?: string; email?: string; phone?: string }) =>
    rawApiClient.post<ContactDto>(`${BASE}/prospects/${id}/contacts`, r),
  deleteContact: (id: string, contactId: string) => rawApiClient.delete<void>(`${BASE}/prospects/${id}/contacts/${contactId}`),

  getWallet: () => rawApiClient.get<WalletDto>(`${BASE}/credits/wallet`),
  getLedger: (p: { type?: string; page?: number; pageSize?: number } = {}) => rawApiClient.get<Paged<LedgerEntryDto>>(`${BASE}/credits/ledger${qs(p)}`),
  getPacks: () => rawApiClient.get<PackDto[]>(`${BASE}/credits/packs`),
  getPurchases: () => rawApiClient.get<PurchaseDto[]>(`${BASE}/credits/purchases`),
  getPaymentOptions: () => rawApiClient.get<PaymentOptionsDto>(`${BASE}/credits/payment-options`),
  checkout: (packId: string, provider: "stripe" | "paypal", returnPath: string) =>
    rawApiClient.post<CheckoutDto>(`${BASE}/credits/checkout`, { packId, provider, returnPath }),
  confirmPayPal: (orderId: string) => rawApiClient.post<PurchaseDto>(`${BASE}/credits/paypal/confirm`, { orderId }),
  setLowBalanceAlert: (threshold: number | null) => rawApiClient.put<void>(`${BASE}/credits/low-balance-alert`, { threshold }),

  getMailboxes: () => rawApiClient.get<MailboxDto[]>(`${BASE}/mailboxes`),
  getMailboxProviders: () => rawApiClient.get<MailboxProvidersDto>(`${BASE}/mailboxes/providers`),
  connectImap: (r: ConnectImapInput) => rawApiClient.post<MailboxDto>(`${BASE}/mailboxes/imap`, r),
  startMailboxOAuth: (provider: "google" | "microsoft", returnPath: string) =>
    rawApiClient.post<{ url: string }>(`${BASE}/mailboxes/oauth/${provider}/start`, { returnPath }),
  updateMailbox: (id: string, r: { dailyLimit: number; signatureText?: string | null; displayName?: string | null }) =>
    rawApiClient.put<MailboxDto>(`${BASE}/mailboxes/${id}`, r),
  pauseMailbox: (id: string) => rawApiClient.post<void>(`${BASE}/mailboxes/${id}/pause`),
  resumeMailbox: (id: string) => rawApiClient.post<void>(`${BASE}/mailboxes/${id}/resume`),
  testMailbox: (id: string, to: string) => rawApiClient.post<void>(`${BASE}/mailboxes/${id}/test`, { to }),
  syncMailbox: (id: string) => rawApiClient.post<{ received: number; replies: number; bounces: number }>(`${BASE}/mailboxes/${id}/sync`),
  disconnectMailbox: (id: string) => rawApiClient.delete<void>(`${BASE}/mailboxes/${id}`),

  getCampaigns: () => rawApiClient.get<CampaignDto[]>(`${BASE}/campaigns`),
  getCampaign: (id: string) => rawApiClient.get<CampaignDto>(`${BASE}/campaigns/${id}`),
  getRecipients: (id: string, p: { status?: string; page?: number; pageSize?: number } = {}) =>
    rawApiClient.get<Paged<RecipientDto>>(`${BASE}/campaigns/${id}/recipients${qs(p)}`),
  previewEmail: (id: string, step: number, prospectId?: string) =>
    rawApiClient.get<PreviewDto>(`${BASE}/campaigns/${id}/preview${qs({ step, prospectId })}`),
  createCampaign: (r: CampaignInput) => rawApiClient.post<CampaignDto>(`${BASE}/campaigns`, r),
  updateCampaign: (id: string, r: CampaignInput) => rawApiClient.put<CampaignDto>(`${BASE}/campaigns/${id}`, r),
  deleteCampaign: (id: string) => rawApiClient.delete<void>(`${BASE}/campaigns/${id}`),
  addRecipients: (id: string, prospectIds: string[]) => rawApiClient.post<AddRecipientsResult>(`${BASE}/campaigns/${id}/recipients`, { prospectIds }),
  removeRecipients: (id: string, recipientIds: string[]) => rawApiClient.post<number>(`${BASE}/campaigns/${id}/recipients/remove`, { recipientIds }),
  startCampaign: (id: string) => rawApiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/start`),
  pauseCampaign: (id: string) => rawApiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/pause`),
  stopCampaign: (id: string) => rawApiClient.post<CampaignDto>(`${BASE}/campaigns/${id}/stop`),
  testCampaign: (id: string, step: number, to: string) => rawApiClient.post<void>(`${BASE}/campaigns/${id}/test`, { step, to }),

  getThreads: (f: ThreadFilter = {}) => rawApiClient.get<Paged<ThreadDto>>(`${BASE}/inbox/threads${qs({ ...f })}`),
  getThread: (id: string) => rawApiClient.get<ThreadDetailDto>(`${BASE}/inbox/threads/${id}`),
  getInboxCounts: () => rawApiClient.get<InboxCountsDto>(`${BASE}/inbox/counts`),
  reply: (id: string, body: string) => rawApiClient.post<MessageDto>(`${BASE}/inbox/threads/${id}/reply`, { body }),
  updateThread: (id: string, r: { classification?: string; assignedUserId?: string; assignedName?: string; clearAssignee?: boolean; archived?: boolean; markRead?: boolean }) =>
    rawApiClient.patch<ThreadDto>(`${BASE}/inbox/threads/${id}`, { clearAssignee: false, ...r }),

  // Super admin
  adminOverview: () => rawApiClient.get<AdminOverviewDto>(`${ADMIN}/overview`),
  adminGetSettings: () => rawApiClient.get<PlatformSettingsDto>(`${ADMIN}/settings`),
  adminUpdateSettings: (s: PlatformSettingsDto) => rawApiClient.put<PlatformSettingsDto>(`${ADMIN}/settings`, s),
  adminGetPacks: () => rawApiClient.get<PackDto[]>(`${ADMIN}/packs`),
  adminCreatePack: (r: PackInput) => rawApiClient.post<PackDto>(`${ADMIN}/packs`, r),
  adminUpdatePack: (id: string, r: PackInput) => rawApiClient.put<PackDto>(`${ADMIN}/packs/${id}`, r),
  adminDeletePack: (id: string) => rawApiClient.delete<void>(`${ADMIN}/packs/${id}`),
  adminGrant: (tenantId: string, amount: number, reason: string) => rawApiClient.post<WalletDto>(`${ADMIN}/grant`, { tenantId, amount, reason }),
};

// ── Presentation helpers ────────────────────────────────────────────────────

/** Money from the smallest unit, in the pack's own currency. */
export const formatPrice = (minor: number, currency: string, locale?: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

/** Quality / fit scores read as a band, not a bare number. */
export const scoreBand = (n: number): "high" | "mid" | "low" => (n >= 70 ? "high" : n >= 40 ? "mid" : "low");

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  discovered:     { color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800" },
  revealed:       { color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  contacted:      { color: "text-violet-600",       bg: "bg-violet-50 dark:bg-violet-900/20" },
  replied:        { color: "text-teal-600",         bg: "bg-teal-50 dark:bg-teal-900/20" },
  qualified:      { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  converted:      { color: "text-success",          bg: "bg-success/10" },
  rejected:       { color: "text-muted-foreground", bg: "bg-muted" },
  do_not_contact: { color: "text-destructive",      bg: "bg-destructive/10" },
  // searches / campaigns / mailboxes
  queued:         { color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800" },
  running:        { color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  completed:      { color: "text-success",          bg: "bg-success/10" },
  failed:         { color: "text-destructive",      bg: "bg-destructive/10" },
  cancelled:      { color: "text-muted-foreground", bg: "bg-muted" },
  draft:          { color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800" },
  active:         { color: "text-success",          bg: "bg-success/10" },
  paused:         { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  stopped:        { color: "text-muted-foreground", bg: "bg-muted" },
  connected:      { color: "text-success",          bg: "bg-success/10" },
  error:          { color: "text-destructive",      bg: "bg-destructive/10" },
  disconnected:   { color: "text-muted-foreground", bg: "bg-muted" },
  pending:        { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  paid:           { color: "text-success",          bg: "bg-success/10" },
  bounced:        { color: "text-destructive",      bg: "bg-destructive/10" },
  unsubscribed:   { color: "text-destructive",      bg: "bg-destructive/10" },
  skipped:        { color: "text-muted-foreground", bg: "bg-muted" },
};
/** Colours only — the words come from i18n. Never index the map bare: an unknown status must not crash a page. */
export const statusStyle = (s: string) => STATUS_STYLES[s] ?? { color: "text-muted-foreground", bg: "bg-muted" };
