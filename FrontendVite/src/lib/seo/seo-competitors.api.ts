import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/seo`;

export interface CompetitorDto { id: string; domain: string; createdAt: string }
export interface LocationOptionDto { code: number; name: string }

export interface ScanSummaryDto {
  id: string; status: "queued" | "running" | "completed" | "failed"; createdAt: string; completedAt: string | null;
  pagesCrawled: number; creditsCharged: number; keywordDataUsed: boolean; keywordDataNote: string | null; error: string | null;
  topicGapCount: number; keywordGapCount: number; locationCode: number;
}

export interface CompetitorsOverviewDto {
  siteId: string; competitors: CompetitorDto[]; max: number; keywordDataAvailable: boolean; estimatedCredits: number;
  pagesPerDomain: number; creditsPerCompetitorKeywords: number; balance: number; latestScan: ScanSummaryDto | null;
  locations: LocationOptionDto[];
}

export interface TopicGapDto { phrase: string; pages: number; competitors: number; exampleTitle: string; exampleUrl: string }
export interface KeywordGapDto { keyword: string; volume: number; difficulty: number | null; competitor: string; position: number; competitorCount: number }
export interface PlanItemDto {
  id: string; plannedDate: string; title: string; targetKeyword: string; reason: string; searchVolume: number | null;
  difficulty: number | null; source: "keyword" | "topic"; status: "planned" | "drafted" | "skipped"; articleId: string | null;
}
export interface ScanDetailDto {
  summary: ScanSummaryDto; competitors: string[]; topicGaps: TopicGapDto[]; keywordGaps: KeywordGapDto[]; plan: PlanItemDto[];
}

export const seoCompetitorsApi = {
  overview: (siteId: string): Promise<CompetitorsOverviewDto> => rawApiClient.get(`${BASE}/sites/${siteId}/competitors`),
  add: (siteId: string, domain: string): Promise<CompetitorDto> => rawApiClient.post(`${BASE}/sites/${siteId}/competitors`, { domain }),
  remove: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/competitors/${id}`),
  start: (siteId: string, locationCode: number): Promise<ScanSummaryDto> => rawApiClient.post(`${BASE}/sites/${siteId}/competitor-scans`, { locationCode }),
  scan: (id: string): Promise<ScanDetailDto> => rawApiClient.get(`${BASE}/competitor-scans/${id}`),
  draft: (id: string): Promise<PlanItemDto> => rawApiClient.post(`${BASE}/plan-items/${id}/draft`, {}),
  skip: (id: string): Promise<PlanItemDto> => rawApiClient.post(`${BASE}/plan-items/${id}/skip`, {}),
};
