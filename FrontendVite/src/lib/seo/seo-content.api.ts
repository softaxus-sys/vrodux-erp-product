import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/seo`;

export type ContentFrequency = "weekly" | "biweekly" | "monthly";
export type ArticleStatus = "pending_review" | "approved" | "rejected";

export interface ContentSettingsDto {
  siteId: string;
  enabled: boolean;
  frequency: ContentFrequency;
  articlesPerRun: number;
  targetWordCount: number;
  nicheHint: string | null;
  competitorDomainsCsv: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface UpdateContentSettingsRequest {
  enabled: boolean;
  frequency: ContentFrequency;
  articlesPerRun: number;
  targetWordCount: number;
  nicheHint?: string | null;
  competitorDomainsCsv?: string | null;
}

export interface ArticleDto {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  metaDescription: string;
  targetKeyword: string;
  bodyMarkdown: string;
  wordCount: number;
  sourceSignalsJson: string;
  status: ArticleStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  wordPressPostId: number | null;
  pushedToWordPressAt: string | null;
  createdAt: string;
}

export interface GenerateArticleNowResultDto {
  articlesCreated: number;
}

export interface WordPressStatusDto {
  connected: boolean;
  siteUrl: string | null;
  username: string | null;
  status: string;
  lastError: string | null;
  autoPublish: boolean;
}

export interface ResearchSignal {
  kind: "gsc_query" | "competitor_topic";
  detail: string;
}

/** Parses ArticleDto.sourceSignalsJson — a plain array of {kind, detail}. */
export function parseSourceSignals(article: ArticleDto): ResearchSignal[] {
  try {
    const parsed = JSON.parse(article.sourceSignalsJson) as ResearchSignal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const ARTICLE_STATUS_META: Record<ArticleStatus, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Pending review", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
  approved:       { label: "Approved",       color: "text-success",   bg: "bg-success/10" },
  rejected:       { label: "Rejected",       color: "text-muted-foreground", bg: "bg-muted" },
};

export const seoContentApi = {
  getSettings: (siteId: string): Promise<ContentSettingsDto> => rawApiClient.get(`${BASE}/sites/${siteId}/content-settings`),
  updateSettings: (siteId: string, body: UpdateContentSettingsRequest): Promise<ContentSettingsDto> =>
    rawApiClient.put(`${BASE}/sites/${siteId}/content-settings`, body),

  getArticles: (siteId: string, status?: string): Promise<ArticleDto[]> =>
    rawApiClient.get(`${BASE}/sites/${siteId}/articles${status ? `?status=${status}` : ""}`),
  generateNow: (siteId: string): Promise<GenerateArticleNowResultDto> => rawApiClient.post(`${BASE}/sites/${siteId}/articles/generate`, {}),
  approveArticle: (id: string): Promise<ArticleDto> => rawApiClient.post(`${BASE}/articles/${id}/approve`, {}),
  rejectArticle: (id: string): Promise<ArticleDto> => rawApiClient.post(`${BASE}/articles/${id}/reject`, {}),
  pushToWordPress: (id: string): Promise<ArticleDto> => rawApiClient.post(`${BASE}/articles/${id}/push-wordpress`, {}),

  getWordPressStatus: (siteId: string): Promise<WordPressStatusDto> => rawApiClient.get(`${BASE}/sites/${siteId}/wordpress`),
  connectWordPress: (siteId: string, siteUrl: string, username: string, appPassword: string): Promise<WordPressStatusDto> =>
    rawApiClient.post(`${BASE}/sites/${siteId}/wordpress`, { siteUrl, username, appPassword }),
  disconnectWordPress: (siteId: string): Promise<void> => rawApiClient.delete(`${BASE}/sites/${siteId}/wordpress`),
  setWordPressAutoPublish: (siteId: string, autoPublish: boolean): Promise<WordPressStatusDto> =>
    rawApiClient.put(`${BASE}/sites/${siteId}/wordpress/auto-publish`, { autoPublish }),
};
