import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/ai`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiProvider = "Claude" | "GroqFree" | "GroqPaid";
export type AiTier = "starter" | "growth" | "enterprise";

/** What the tenant's plan tier unlocks + which optional features the admin turned on. No secrets. */
export interface AiCapabilitiesDto {
  tier: AiTier;
  voice: boolean;
  telegram: boolean;
  automations: boolean;
  autopilot: boolean;
  /** -1 = unlimited. */
  maxAutomationRules: number;
  voiceEnabled: boolean;
  telegramEnabled: boolean;
  aiEnabled: boolean;
}

export interface AiSettingsDto {
  provider: AiProvider;
  model: string | null;
  enabled: boolean;
  tier: AiTier;
  voiceEnabled: boolean;
  telegramEnabled: boolean;
  /** True when an API key is stored. The key itself is never returned. */
  hasApiKey: boolean;
  telegramBotUsername: string | null;
  hasTelegramBotToken: boolean;
  telegramInboundKey: string | null;
  capabilities: AiCapabilitiesDto | null;
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
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  clearTelegramBot?: boolean;
}

/** Current user's Telegram connection state. */
export interface TelegramLinkStatus {
  botConfigured: boolean;
  linked: boolean;
  telegramUsername: string | null;
  code: string | null;
  deepLink: string | null;
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

/** A write action the assistant wants to perform — the user must confirm it. */
export interface PendingAction {
  id: string;
  toolName: string;
  argumentsJson: string;
  summary: string;
}

export interface AiChatResponse {
  reply: string;
  toolsUsed: string[];
  provider: string;
  model: string;
  pendingAction: PendingAction | null;
  agent: string | null;
}

export interface ConfirmActionPayload {
  toolName: string;
  argumentsJson: string;
}

/** A named agent the current user can talk to (call-by-name target). */
export interface AiAgentDto {
  key: string;
  label: string;
  toolCount: number;
}

// ── Automations (M4 — scheduled autonomous rules) ──────────────────────────────

export type AiRuleMode = "autopilot" | "confirm";
export type AiRuleFrequency = "interval" | "hourly" | "daily" | "weekly";
export type AiRunStatus =
  | "running"
  | "success"
  | "failed"
  | "pending_confirmation"
  | "rejected";

export interface AutomationRunDto {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredBy: "schedule" | "manual";
  status: AiRunStatus;
  summary: string | null;
  toolsUsed: string | null;
  error: string | null;
  pendingToolName: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AutomationRuleSummaryDto {
  id: string;
  name: string;
  agent: string | null;
  agentLabel: string | null;
  mode: AiRuleMode;
  frequency: AiRuleFrequency;
  scheduleLabel: string;
  enabled: boolean;
  notifyTelegram: boolean;
  runAsUserName: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: AiRunStatus | null;
  runCount: number;
  pendingCount: number;
}

export interface AutomationRuleDto {
  id: string;
  name: string;
  description: string | null;
  agent: string | null;
  agentLabel: string | null;
  instruction: string;
  runAsUserId: string;
  runAsUserName: string;
  mode: AiRuleMode;
  frequency: AiRuleFrequency;
  intervalMinutes: number | null;
  hourUtc: number | null;
  minuteUtc: number;
  dayOfWeekUtc: number | null;
  scheduleLabel: string;
  notifyTelegram: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: AiRunStatus | null;
  lastError: string | null;
  runCount: number;
  recentRuns: AutomationRunDto[];
}

export interface SaveAutomationRulePayload {
  name: string;
  description?: string | null;
  agent?: string | null;
  instruction: string;
  runAsUserId?: string | null;
  runAsUserName?: string | null;
  mode: AiRuleMode;
  frequency: AiRuleFrequency;
  intervalMinutes?: number | null;
  hourUtc?: number | null;
  minuteUtc: number;
  dayOfWeekUtc?: number | null;
  notifyTelegram: boolean;
  /** Only used on create; update keeps the current enabled state. */
  enabled?: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  getSettings: (): Promise<AiSettingsDto> =>
    rawApiClient.get(`${BASE}/settings`),

  updateSettings: (payload: UpdateAiSettingsPayload): Promise<AiSettingsDto> =>
    rawApiClient.put(`${BASE}/settings`, payload),

  sendChat: (payload: SendChatPayload): Promise<AiChatResponse> =>
    rawApiClient.post(`${BASE}/chat`, payload),

  confirmAction: (payload: ConfirmActionPayload): Promise<AiChatResponse> =>
    rawApiClient.post(`${BASE}/confirm`, payload),

  getAgents: (): Promise<AiAgentDto[]> =>
    rawApiClient.get(`${BASE}/agents`),

  /** Tenant AI capabilities — available to any authenticated user (no secrets). */
  getCapabilities: (): Promise<AiCapabilitiesDto> =>
    rawApiClient.get(`${BASE}/capabilities`),

  // ── Telegram ──────────────────────────────────────────────────────────────
  getTelegramStatus: (): Promise<TelegramLinkStatus> =>
    rawApiClient.get(`${BASE}/telegram`),

  generateTelegramLink: (): Promise<TelegramLinkStatus> =>
    rawApiClient.post(`${BASE}/telegram/link`),

  unlinkTelegram: (): Promise<void> =>
    rawApiClient.post(`${BASE}/telegram/unlink`),

  registerTelegramWebhook: (): Promise<string> =>
    rawApiClient.post(`${BASE}/telegram/register-webhook`),

  // ── Automations ─────────────────────────────────────────────────────────────
  getAutomations: (): Promise<AutomationRuleSummaryDto[]> =>
    rawApiClient.get(`${BASE}/automations`),

  getAutomation: (id: string): Promise<AutomationRuleDto> =>
    rawApiClient.get(`${BASE}/automations/${id}`),

  createAutomation: (payload: SaveAutomationRulePayload): Promise<AutomationRuleDto> =>
    rawApiClient.post(`${BASE}/automations`, payload),

  updateAutomation: (id: string, payload: SaveAutomationRulePayload): Promise<AutomationRuleDto> =>
    rawApiClient.put(`${BASE}/automations/${id}`, payload),

  enableAutomation: (id: string): Promise<AutomationRuleDto> =>
    rawApiClient.post(`${BASE}/automations/${id}/enable`),

  disableAutomation: (id: string): Promise<AutomationRuleDto> =>
    rawApiClient.post(`${BASE}/automations/${id}/disable`),

  deleteAutomation: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/automations/${id}`),

  runAutomationNow: (id: string): Promise<AutomationRunDto> =>
    rawApiClient.post(`${BASE}/automations/${id}/run`),

  approveAutomationRun: (runId: string): Promise<AutomationRunDto> =>
    rawApiClient.post(`${BASE}/automations/runs/${runId}/approve`),

  rejectAutomationRun: (runId: string): Promise<AutomationRunDto> =>
    rawApiClient.post(`${BASE}/automations/runs/${runId}/reject`),
};
