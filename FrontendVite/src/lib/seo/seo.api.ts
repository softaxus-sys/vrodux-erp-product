import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/seo`;

// ── Types ───────────────────────────────────────────────────────────────────

export type ScanFrequency = "weekly" | "monthly";
export type SiteVerificationStatus = "pending" | "verified";
export type SiteStatus = "active" | "paused";

export interface SiteDto {
  id: string;
  domain: string;
  displayName: string;
  snippetKey: string;
  scanFrequency: ScanFrequency;
  verificationStatus: SiteVerificationStatus;
  verifiedAt: string | null;
  lastSeenAt: string | null;
  lastScanAt: string | null;
  nextScanAt: string | null;
  status: SiteStatus;
  googleConnected: boolean;
  createdAt: string;
  selectedGscProperty: string | null;
  selectedGa4Property: string | null;
  lastScore?: number | null;
  lastPagesCrawled?: number;
}

export interface CreateSiteRequest {
  domain: string;
  displayName: string;
  scanFrequency?: ScanFrequency;
}

export interface UpdateSiteRequest {
  displayName: string;
  scanFrequency: ScanFrequency;
}

export type GoogleResourceType = "gsc_property" | "ga4_property";

export interface GooglePropertyDto {
  externalId: string;
  name: string;
  resourceType: GoogleResourceType;
}

export interface GooglePropertiesResultDto {
  gscProperties: GooglePropertyDto[];
  ga4Properties: GooglePropertyDto[];
}

export interface SelectGooglePropertiesRequest {
  gscPropertyId?: string | null;
  gscPropertyName?: string | null;
  ga4PropertyId?: string | null;
  ga4PropertyName?: string | null;
}

export type AuditStatus = "running" | "completed" | "failed";

export interface AuditDto {
  id: string;
  siteId: string;
  status: AuditStatus;
  startedAt: string;
  completedAt: string | null;
  issuesFound: number;
  fixesProposed: number;
  error: string | null;
  score?: number | null;
  pagesCrawled?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  newIssues?: number;
  resolvedIssues?: number;
  creditsCharged?: number;
  durationMs?: number;
  truncated?: boolean;
}

export type IssueSource = "crawl" | "gsc";
export type IssueCategory = "technical" | "metadata" | "content" | "indexing" | "links" | "performance";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "proposed" | "approved" | "applied" | "dismissed" | "resolved";

export interface IssueDto {
  id: string;
  siteId: string;
  auditId: string;
  source: IssueSource;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  pageUrl: string | null;
  status: IssueStatus;
  detectedAt: string;
  /** Stable rule id, e.g. "title.missing". Empty on issues from before audits had rule ids. */
  code?: string;
  affectedCount?: number;
  /** JSON array of affected / referring page URLs. */
  detailsJson?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  resolvedAt?: string | null;
}

export interface PageDto {
  id: string;
  auditId: string;
  url: string;
  finalUrl: string | null;
  statusCode: number;
  redirectHops: number;
  responseMs: number;
  htmlBytes: number;
  depth: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  indexable: boolean;
  inSitemap: boolean;
  internalLinksIn: number;
  internalLinksOut: number;
  issueCount: number;
  error: string | null;
}

export interface CreditEntryDto {
  id: string;
  type: "grant" | "spend" | "refund" | "adjustment";
  amount: number;
  balanceAfter: number;
  reason: string;
  actorName: string | null;
  createdAt: string;
}

export interface SeoCreditsDto {
  balance: number;
  lifetimeAdded: number;
  lifetimeSpent: number;
  pagesPerCredit: number;
  maxPagesPerAudit: number;
  recent: CreditEntryDto[];
}

export interface CatalogueSeoItemDto {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  publishedOnline: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  descriptionWords: number;
  imageCount: number;
  imagesMissingAlt: number;
  score: number;
  problems: string[];
}

export interface CatalogueSeoDto {
  total: number;
  withProblems: number;
  averageScore: number;
  items: CatalogueSeoItemDto[];
}

export interface CatalogueSuggestionDto {
  id: string;
  seoTitle: string;
  metaDescription: string;
  note: string | null;
}

/** Plain-language names for the rule codes the audit and catalogue checks produce. */
export const RULE_LABELS: Record<string, string> = {
  "title.missing": "Missing page title", "title.long": "Title too long", "title.short": "Title too short", "title.multiple": "More than one title tag",
  "desc.missing": "Missing meta description", "desc.long": "Meta description too long", "desc.short": "Meta description too short",
  "canonical.missing": "Missing canonical tag", "canonical.other-host": "Canonical points to another site",
  "schema.missing": "No structured data", "schema.invalid": "Structured data cannot be read",
  "h1.missing": "Missing H1", "h1.multiple": "Multiple H1s", "h1.empty": "Empty H1",
  "alt.missing": "Images missing alt text", "lang.missing": "No language declared", "viewport.missing": "No mobile viewport",
  "og.missing": "Incomplete social sharing tags", "content.thin": "Thin content",
  "perf.slow": "Slow response", "perf.very-slow": "Very slow response", "perf.large": "Very large page",
  "index.noindex": "In sitemap but set to noindex", "link.mixed-content": "Insecure content on a secure page", "depth.deep": "Page is deep in the site",
  "status.server-error": "Server error", "redirect.chain": "Redirect chain", "redirect.internal-link": "Link goes through a redirect", "redirect.loop": "Redirect loop",
  "https.not-enforced": "http does not redirect to https", "robots.missing": "No robots.txt", "robots.blocks-all": "robots.txt blocks the whole site",
  "sitemap.missing": "No sitemap", "sitemap.bad-urls": "Sitemap lists pages that do not load",
  "dup.title": "Duplicate titles", "dup.desc": "Duplicate meta descriptions", "dup.h1": "Duplicate H1s",
  "link.broken-internal": "Broken internal links", "link.broken-external": "Broken outbound links", "page.orphan": "Orphan pages", "crawl.limit": "Not every page was checked",
  "image.missing": "No product photo", "title.duplicate": "Duplicate search title",
};

export function ruleLabel(code: string | undefined, fallback: string): string {
  return (code && RULE_LABELS[code]) || fallback;
}

export function affectedUrls(issue: IssueDto): string[] {
  if (!issue.detailsJson) return [];
  try {
    const v = JSON.parse(issue.detailsJson);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type FixChangeType = "title" | "meta_description" | "canonical" | "schema" | "alt_text";
export type FixStatus = "pending_review" | "rejected" | "applied";

export interface FixDto {
  id: string;
  issueId: string;
  siteId: string;
  pageUrl: string | null;
  changeType: FixChangeType;
  proposedValueJson: string;
  rationale: string;
  status: FixStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  issueTitle: string;
  issueSeverity: IssueSeverity;
  issueCategory: IssueCategory;
}

export interface RunScanNowResultDto {
  auditId: string;
  issuesFound: number;
  fixesProposed: number;
  score?: number;
  pagesCrawled?: number;
  newIssues?: number;
  resolvedIssues?: number;
  creditsCharged?: number;
  creditBalance?: number;
}

/** Parses `FixDto.proposedValueJson` — always `{"value": "..."}` for the change types Phase 1 supports. */
export function proposedValue(fix: FixDto): string {
  try {
    const parsed = JSON.parse(fix.proposedValueJson) as { value?: string };
    return parsed.value ?? fix.proposedValueJson;
  } catch {
    return fix.proposedValueJson;
  }
}

export const SEVERITY_META: Record<IssueSeverity, { color: string; bg: string }> = {
  critical: { color: "text-destructive", bg: "bg-destructive/10" },
  high:     { color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  medium:   { color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  low:      { color: "text-muted-foreground", bg: "bg-muted" },
};

export const FIX_STATUS_META: Record<FixStatus, { color: string; bg: string }> = {
  pending_review: { color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  applied:        { color: "text-success",     bg: "bg-success/10" },
  rejected:       { color: "text-muted-foreground", bg: "bg-muted" },
};

export const CHANGE_TYPE_LABELS: Record<FixChangeType, string> = {
  title: "Page title",
  meta_description: "Meta description",
  canonical: "Canonical URL",
  schema: "Structured data (schema)",
  alt_text: "Image alt text",
};

export const seoApi = {
  getSites: (): Promise<SiteDto[]> => rawApiClient.get(`${BASE}/sites`),
  getSite: (id: string): Promise<SiteDto> => rawApiClient.get(`${BASE}/sites/${id}`),
  createSite: (body: CreateSiteRequest): Promise<SiteDto> => rawApiClient.post(`${BASE}/sites`, body),
  updateSite: (id: string, body: UpdateSiteRequest): Promise<SiteDto> => rawApiClient.put(`${BASE}/sites/${id}`, body),
  deleteSite: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/sites/${id}`),
  rotateSnippetKey: (id: string): Promise<SiteDto> => rawApiClient.post(`${BASE}/sites/${id}/rotate-snippet-key`, {}),
  /** Server-side verification — our own gateway fetches the tenant's page and checks the tag is
   * present in the raw HTML, so a customer's CSP/ad-blocker can never block verification itself. */
  verifyNow: (id: string): Promise<SiteDto> => rawApiClient.post(`${BASE}/sites/${id}/verify-now`, {}),

  startGoogleOAuth: (siteId: string): Promise<{ url: string }> =>
    rawApiClient.post(`${BASE}/google/${siteId}/oauth/start`, {}),
  getGoogleProperties: (siteId: string): Promise<GooglePropertiesResultDto> =>
    rawApiClient.get(`${BASE}/google/${siteId}/properties`),
  selectGoogleProperties: (siteId: string, body: SelectGooglePropertiesRequest): Promise<void> =>
    rawApiClient.post(`${BASE}/google/${siteId}/select`, body),

  getAudits: (siteId: string): Promise<AuditDto[]> => rawApiClient.get(`${BASE}/sites/${siteId}/audits`),
  getIssues: (siteId: string, status?: string): Promise<IssueDto[]> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/issues${status ? `?status=${status}` : ""}`),

  getPages: (siteId: string, auditId?: string): Promise<PageDto[]> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/pages${auditId ? `?auditId=${auditId}` : ""}`),
  getCredits: (): Promise<SeoCreditsDto> => rawApiClient.get(`${BASE}/credits`),
  getCatalogue: (): Promise<CatalogueSeoDto> => rawApiClient.get(`${BASE}/catalogue`),
  suggestCatalogue: (id: string): Promise<CatalogueSuggestionDto> => rawApiClient.post(`${BASE}/catalogue/${id}/suggest`, {}),
  applyCatalogue: (id: string, body: { seoTitle?: string; metaDescription?: string }): Promise<CatalogueSeoItemDto> =>
    rawApiClient.post(`${BASE}/catalogue/${id}/apply`, body),
  getFixes: (siteId: string, status?: string): Promise<FixDto[]> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/fixes${status ? `?status=${status}` : ""}`),
  runScanNow: (siteId: string): Promise<RunScanNowResultDto> => rawApiClient.post(`${BASE}/sites/${siteId}/scan`, {}),
  approveFix: (id: string, editedValueJson?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/fixes/${id}/approve`, { editedValueJson: editedValueJson ?? null }),
  rejectFix: (id: string): Promise<void> => rawApiClient.post(`${BASE}/fixes/${id}/reject`, {}),
};
