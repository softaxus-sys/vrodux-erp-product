import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/seo`;

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
}

export type IssueSource = "crawl" | "gsc";
export type IssueCategory = "technical" | "metadata" | "content" | "indexing";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "proposed" | "approved" | "applied" | "dismissed";

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

  getFixes: (siteId: string, status?: string): Promise<FixDto[]> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/fixes${status ? `?status=${status}` : ""}`),
  runScanNow: (siteId: string): Promise<RunScanNowResultDto> => rawApiClient.post(`${BASE}/sites/${siteId}/scan`, {}),
  approveFix: (id: string, editedValueJson?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/fixes/${id}/approve`, { editedValueJson: editedValueJson ?? null }),
  rejectFix: (id: string): Promise<void> => rawApiClient.post(`${BASE}/fixes/${id}/reject`, {}),
};
