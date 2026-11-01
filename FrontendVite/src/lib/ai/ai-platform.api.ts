import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import type { AiProvider } from "@/lib/ai/ai.api";

const BASE = `${getApiBaseUrl()}/api/admin/ai-platform`;

/** The platform-wide AI the super admin provides to every workspace without its own key. Keys are write-only. */
export interface PlatformAiDto {
  enabled: boolean;
  provider: AiProvider;
  model: string | null;
  hasApiKey: boolean;
  /** 0 = unlimited. */
  monthlyMessageCapPerTenant: number;
  /** Every Nth shared message suggests the workspace add its own key. 0 = never. */
  nudgeEveryMessages: number;
  showOwnKeyBanner: boolean;
  voiceEnabled: boolean;
  sttModel: string | null;
  ttsModel: string | null;
  ttsVoice: string | null;
  voiceMonthlyCapPerTenant: number;
  hasVoiceApiKey: boolean;
  /** Workspaces without their own key can be served right now. */
  ready: boolean;
  readyIssue: string | null;
  updatedAt: string;
}

export interface UpdatePlatformAiPayload {
  enabled: boolean;
  provider: AiProvider;
  model: string | null;
  apiKey?: string | null;
  clearApiKey: boolean;
  monthlyMessageCapPerTenant: number;
  nudgeEveryMessages: number;
  showOwnKeyBanner: boolean;
  voiceEnabled: boolean;
  sttModel: string | null;
  ttsModel: string | null;
  ttsVoice: string | null;
  voiceMonthlyCapPerTenant: number;
  voiceApiKey?: string | null;
  clearVoiceApiKey: boolean;
}

export interface PlatformAiTestResult { ok: boolean; message: string; latencyMs: number; sample: string | null }

export interface PlatformAiUsageRow { tenantId: string; tenantName: string; month: string; messages: number; voiceTurns: number }

export const aiPlatformApi = {
  get: (): Promise<PlatformAiDto> => rawApiClient.get(BASE),
  update: (p: UpdatePlatformAiPayload): Promise<PlatformAiDto> => rawApiClient.put(BASE, p),
  test: (): Promise<PlatformAiTestResult> => rawApiClient.post(`${BASE}/test`, {}),
  usage: (month?: string): Promise<PlatformAiUsageRow[]> =>
    rawApiClient.get(`${BASE}/usage${month ? `?month=${encodeURIComponent(month)}` : ""}`),
};
