/**
 * Mirrors the response/payload shapes FrontendVite/src/lib/ai/ai.api.ts defines -- same backend
 * (`/api/ai/*`), same REST (no streaming) contract. Only the chat + confirm/reject + agent-picker
 * slice is ported for this first pass; settings/Telegram/voice/automations are a separate,
 * lower-priority follow-up (see Mobile/README.md).
 */

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface SendChatPayload {
  message: string;
  history?: ChatHistoryItem[];
  agent?: string | null;
}

/** A write action the assistant wants to perform -- the user must confirm it. */
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
  /** True when this reply came from the tenant's fallback provider (primary was rate-limited). */
  usedFallback: boolean;
}

export interface ConfirmActionPayload {
  toolName: string;
  argumentsJson: string;
}

/** One persisted chat turn, as stored server-side per user. */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  usedFallback?: boolean;
}

/** The caller's ongoing assistant conversation -- persists across app restarts and logins. */
export interface AiConversationDto {
  conversationId: string | null;
  messages: StoredChatMessage[];
}

/** A named agent the current user can talk to (call-by-name target in the picker). */
export interface AiAgentDto {
  key: string;
  label: string;
  toolCount: number;
}
