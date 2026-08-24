import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/ai`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiProvider = "Claude" | "GroqFree" | "GroqPaid" | "OpenRouter";
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
  /**
   * Optional BYO fallback provider — tried once when the primary is rate-limited/unavailable.
   * fallbackEnabled is independent of provider/model/hasFallbackApiKey, same as `enabled` is
   * independent of `hasApiKey` above — turning it off never clears the stored key.
   */
  fallbackEnabled: boolean;
  fallbackProvider: AiProvider | null;
  fallbackModel: string | null;
  /** True when a fallback key is stored. The key itself is never returned. */
  hasFallbackApiKey: boolean;
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
  /** Independent of provider/model/key, same as `enabled` vs `apiKey` above. */
  fallbackEnabled: boolean;
  /** The tenant's own second key — never subsidized by us. */
  fallbackProvider?: AiProvider | null;
  fallbackModel?: string | null;
  /** New plaintext fallback key; omit/null to leave the stored key unchanged. */
  fallbackApiKey?: string | null;
  clearFallbackApiKey?: boolean;
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

/** One persisted chat turn, as stored server-side per user. */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** True when this assistant reply came from the tenant's fallback provider, not the primary. */
  usedFallback?: boolean;
}

/** The caller's ongoing assistant conversation — persists across navigation and logins. */
export interface AiConversationDto {
  conversationId: string | null;
  messages: StoredChatMessage[];
}

export interface AiChatResponse {
  reply: string;
  toolsUsed: string[];
  provider: string;
  model: string;
  pendingAction: PendingAction | null;
  agent: string | null;
  /** True when this reply came from the fallback provider (primary was rate-limited/unavailable). */
  usedFallback: boolean;
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
export type AiRuleTrigger = "schedule" | "event";
export type AiRuleFrequency = "interval" | "hourly" | "daily" | "weekly";

/** One selectable event-trigger option (from GET /automations/event-types). */
export interface AiEventCatalogItem {
  key: string;
  label: string;
  description: string;
}
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
  triggerType: AiRuleTrigger;
  eventKey: string | null;
  eventLabel: string | null;
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
  triggerType: AiRuleTrigger;
  eventKey: string | null;
  eventLabel: string | null;
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
  triggerType: AiRuleTrigger;
  eventKey?: string | null;
  frequency: AiRuleFrequency;
  intervalMinutes?: number | null;
  hourUtc?: number | null;
  minuteUtc: number;
  dayOfWeekUtc?: number | null;
  notifyTelegram: boolean;
  /** Only used on create; update keeps the current enabled state. */
  enabled?: boolean;
}

// ── Voice agent (outbound AI calls via BYO Vapi) ───────────────────────────────

export type VoiceLanguage = "en" | "ur" | "ar";

export type ScheduledCallStatus =
  | "pending"
  | "dialing"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "failed"
  | "canceled";

export interface VoiceSettingsDto {
  enabled: boolean;
  /** True when a Vapi key is stored. The key itself is never returned. */
  hasVapiApiKey: boolean;
  vapiPhoneNumberId: string | null;
  /** A persistent Vapi dashboard assistant to use instead of the generated per-call one. */
  vapiAssistantId: string | null;
  runAsUserId: string;
  callDelayMinutes: number;
  maxAttempts: number;
  /** 0 = unlimited. */
  monthlyMinutesCap: number;
  minutesUsedThisMonth: number;
  defaultLanguage: VoiceLanguage;
  agentName: string | null;
  companyName: string | null;
  companyDescription: string | null;
  industry: string | null;
  knowledge: string | null;
}

export interface UpdateVoiceSettingsPayload {
  enabled: boolean;
  /** New plaintext key; omit/null to leave the stored key unchanged. */
  vapiApiKey?: string | null;
  clearVapiApiKey: boolean;
  vapiPhoneNumberId?: string | null;
  vapiAssistantId?: string | null;
  runAsUserId: string;
  callDelayMinutes: number;
  maxAttempts: number;
  monthlyMinutesCap: number;
  defaultLanguage: VoiceLanguage;
  agentName?: string | null;
  companyName?: string | null;
  companyDescription?: string | null;
  industry?: string | null;
  knowledge?: string | null;
}

export interface ScheduledCallDto {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  language: VoiceLanguage;
  status: ScheduledCallStatus;
  attemptCount: number;
  dueAt: string;
  endedReason: string | null;
  durationSeconds: number;
  recordingUrl: string | null;
  summary: string | null;
  transcriptText: string | null;
  error: string | null;
  leadUpdated: boolean;
  createdAt: string;
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

  /** The caller's persisted chat history, so it survives navigating away and back. */
  getConversation: (): Promise<AiConversationDto> =>
    rawApiClient.get(`${BASE}/conversation`),

  /** Clears the caller's persisted conversation. */
  clearConversation: (): Promise<void> =>
    rawApiClient.delete(`${BASE}/conversation`),

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

  // ── Voice agent ─────────────────────────────────────────────────────────────
  getVoiceSettings: (): Promise<VoiceSettingsDto> =>
    rawApiClient.get(`${BASE}/voice/settings`),

  updateVoiceSettings: (payload: UpdateVoiceSettingsPayload): Promise<VoiceSettingsDto> =>
    rawApiClient.put(`${BASE}/voice/settings`, payload),

  getVoiceCalls: (take = 50): Promise<ScheduledCallDto[]> =>
    rawApiClient.get(`${BASE}/voice/calls?take=${take}`),

  // ── Automations ─────────────────────────────────────────────────────────────
  getAutomations: (): Promise<AutomationRuleSummaryDto[]> =>
    rawApiClient.get(`${BASE}/automations`),

  getAutomationEventTypes: (): Promise<AiEventCatalogItem[]> =>
    rawApiClient.get(`${BASE}/automations/event-types`),

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
