import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/messaging/whatsapp`;

export interface WaAutoReplies {
  welcomeEnabled: boolean; welcomeMessage: string | null;
  awayEnabled: boolean; awayMessage: string | null;
  timeZoneId: string; opensAt: string; closesAt: string; workDays: number[];
  createLeads: boolean; defaultCountryCode: string;
}

export interface WaConnection {
  connected: boolean; status: string | null; phoneNumberId: string | null; wabaId: string | null;
  displayPhone: string | null; verifiedName: string | null; lastError: string | null; connectedAt: string | null;
  webhookUrl: string; webhookConfigured: boolean; autoReplies: WaAutoReplies;
  /** This workspace's own verify token (only for people who can see setup). */
  verifyToken: string | null;
  /** This workspace saved its own Meta app secret. */
  appSecretSet: boolean;
  /** The server has a shared Vrodux Meta app configured. */
  sharedAppAvailable: boolean;
  /** Incoming deliveries for this workspace will verify. */
  incomingReady: boolean;
}

export interface WaTemplate {
  id: string; name: string; language: string; category: string; status: string;
  headerText: string | null; bodyText: string; footerText: string | null; variableCount: number;
  rejectedReason: string | null; syncedAt: string;
}

export interface WaConversation {
  id: string; contactPhone: string; contactName: string | null;
  relatedType: string | null; relatedId: string | null; relatedName: string | null;
  lastMessageAt: string; lastMessagePreview: string | null; unreadCount: number; optedOut: boolean;
  windowOpen: boolean; windowClosesAt: string | null;
}

export interface WaMessage {
  id: string; conversationId: string; direction: "in" | "out"; type: string; body: string;
  templateName: string | null; status: string; error: string | null; origin: string;
  sentByName: string | null; createdAt: string; statusAt: string | null;
}

export interface WaKeywordRule { id: string; keyword: string; matchType: "contains" | "exact"; reply: string; isActive: boolean; }

export interface WaAutomation {
  eventKey: string; label: string; description: string; enabled: boolean;
  templateName: string | null; language: string | null; variableFields: string[]; availableFields: string[];
}

export interface WaSendRequest {
  to: string; text?: string; templateName?: string; language?: string; variables?: string[];
  relatedType?: string; relatedId?: string; relatedName?: string; contactName?: string;
}

export interface WaSendResult { messageId: string; conversationId: string; status: string; error: string | null; }

export interface WaThread { conversation: WaConversation | null; messages: WaMessage[]; }

const qs = (p: Record<string, string | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
};

export const whatsappApi = {
  getConnection:   () => rawApiClient.get<WaConnection>(`${BASE}/connection`),
  setAppSecret:    (appSecret: string | null) => rawApiClient.put<WaConnection>(`${BASE}/app-secret`, { appSecret }),
  connect:         (b: { phoneNumberId: string; wabaId: string; accessToken: string; appSecret?: string }) =>
    rawApiClient.post<WaConnection>(`${BASE}/connection`, b),
  disconnect:      () => rawApiClient.delete<void>(`${BASE}/connection`),
  updateAutoReplies: (b: WaAutoReplies) => rawApiClient.put<WaConnection>(`${BASE}/auto-replies`, b),

  getTemplates:    (approvedOnly = false) => rawApiClient.get<WaTemplate[]>(`${BASE}/templates${qs({ approvedOnly })}`),
  syncTemplates:   () => rawApiClient.post<WaTemplate[]>(`${BASE}/templates/sync`),
  createTemplate:  (b: { name: string; language: string; category: string; headerText?: string; bodyText: string; footerText?: string; examples?: string[] }) =>
    rawApiClient.post<WaTemplate>(`${BASE}/templates`, b),

  send:            (b: WaSendRequest) => rawApiClient.post<WaSendResult>(`${BASE}/send`, b),
  getConversations: (search?: string, unreadOnly?: boolean) =>
    rawApiClient.get<WaConversation[]>(`${BASE}/conversations${qs({ search, unreadOnly })}`),
  getMessages:     (id: string) => rawApiClient.get<WaMessage[]>(`${BASE}/conversations/${id}/messages`),
  markRead:        (id: string) => rawApiClient.post<void>(`${BASE}/conversations/${id}/read`),
  getThread:       (relatedType: string, relatedId: string, phone?: string | null) =>
    rawApiClient.get<WaThread>(`${BASE}/thread${qs({ relatedType, relatedId, phone })}`),

  getRules:        () => rawApiClient.get<WaKeywordRule[]>(`${BASE}/keyword-rules`),
  saveRule:        (b: Omit<WaKeywordRule, "id"> & { id?: string }) => rawApiClient.post<WaKeywordRule>(`${BASE}/keyword-rules`, b),
  deleteRule:      (id: string) => rawApiClient.delete<void>(`${BASE}/keyword-rules/${id}`),

  getAutomations:  () => rawApiClient.get<WaAutomation[]>(`${BASE}/automations`),
  saveAutomation:  (b: { eventKey: string; enabled: boolean; templateName: string | null; language: string | null; variableFields: string[] }) =>
    rawApiClient.put<WaAutomation>(`${BASE}/automations`, b),
};

/** Fills {{1}}, {{2}}, … for a preview. */
export function fillTemplate(body: string, values: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (m, n) => values[Number(n) - 1] || m);
}
