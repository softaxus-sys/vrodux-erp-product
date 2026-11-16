import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/seo`;

export type ProfileSource = "manual" | "tenant" | "website";

export interface BusinessProfileDto {
  siteId: string;
  exists: boolean;
  /** Enough to steer content (a complete profile, or an older "what is this site about" note that is a real sentence). */
  ready: boolean;
  usingNicheHint: boolean;
  businessName: string;
  industry: string;
  summary: string;
  offers: string[];
  audience: string;
  serviceAreas: string;
  avoidTopics: string[];
  source: ProfileSource;
  importedFromTenantAt: string | null;
  updatedAt: string | null;
  /** Filled in automatically and not yet confirmed by a person; a draft never steers content. */
  isDraft: boolean;
  autofillStatus: "none" | "pending" | "done" | "failed";
  autofillNote: string | null;
}

export interface SaveBusinessProfileRequest {
  businessName: string;
  industry: string | null;
  summary: string;
  offers: string[];
  audience: string | null;
  serviceAreas: string | null;
  avoidTopics: string[];
  source?: ProfileSource;
}

export interface TenantProfilePreviewDto {
  enough: boolean;
  missing: string[];
  notInWorkspace: string[];
  businessName: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  siteDomain: string | null;
  websiteMatches: boolean | null;
  proposedSummary: string;
  proposedServiceAreas: string;
}

export interface BusinessProfileDraftDto {
  industry: string | null;
  summary: string;
  offers: string[];
  audience: string;
  serviceAreas: string;
  pagesRead: number;
}

export interface SuggestedCompetitorDto { domain: string; sharedKeywords: number; averagePosition: number | null }
export interface SuggestedCompetitorsDto { suggestions: SuggestedCompetitorDto[]; creditsCharged: number; note: string | null }

export const seoProfileApi = {
  get: (siteId: string): Promise<BusinessProfileDto> => rawApiClient.get(`${BASE}/sites/${siteId}/business-profile`),
  save: (siteId: string, body: SaveBusinessProfileRequest): Promise<BusinessProfileDto> =>
    rawApiClient.put(`${BASE}/sites/${siteId}/business-profile`, body),
  tenantPreview: (siteId: string): Promise<TenantProfilePreviewDto> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/business-profile/tenant-preview`),
  importFromTenant: (siteId: string, overwrite: boolean): Promise<BusinessProfileDto> =>
    rawApiClient.post(`${BASE}/sites/${siteId}/business-profile/import-from-tenant`, { overwrite }),
  autofill: (siteId: string): Promise<BusinessProfileDto> =>
    rawApiClient.post(`${BASE}/sites/${siteId}/business-profile/autofill`, {}),
  draftFromWebsite: (siteId: string): Promise<BusinessProfileDraftDto> =>
    rawApiClient.post(`${BASE}/sites/${siteId}/business-profile/draft-from-website`, {}),
  suggestCompetitors: (siteId: string, locationCode: number): Promise<SuggestedCompetitorsDto> =>
    rawApiClient.post(`${BASE}/sites/${siteId}/competitor-suggestions`, { locationCode }),
};
