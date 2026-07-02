import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/ai`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiProvider = "Claude" | "GroqFree" | "GroqPaid";
export type AiTier = "starter" | "growth" | "enterprise";

export interface AiSettingsDto {
  provider: AiProvider;
  model: string | null;
  enabled: boolean;
  tier: AiTier;
  voiceEnabled: boolean;
  telegramEnabled: boolean;
  /** True when an API key is stored. The key itself is never returned. */
  hasApiKey: boolean;
}

export interface UpdateAiSettingsPayload {
  provider: AiProvider;
  model?: string | null;
  tier: AiTier;
  enabled: boolean;
  voiceEnabled: boolean;
  telegramEnabled: boolean;
  /** New plaintext key; omit/null to leave the stored key unchanged. */
  apiKey?: string | null;
  /** Set true to remove the stored key. */
  clearApiKey: boolean;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface SendChatPayload {
  message: string;
  history?: ChatHistoryItem[];
  agent?: string | null;
}

export interface AiChatResponse {
  reply: string;
  toolsUsed: string[];
  provider: string;
  model: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  getSettings: (): Promise<AiSettingsDto> =>
    rawApiClient.get(`${BASE}/settings`),

  updateSettings: (payload: UpdateAiSettingsPayload): Promise<AiSettingsDto> =>
    rawApiClient.put(`${BASE}/settings`, payload),

  sendChat: (payload: SendChatPayload): Promise<AiChatResponse> =>
    rawApiClient.post(`${BASE}/chat`, payload),
};
