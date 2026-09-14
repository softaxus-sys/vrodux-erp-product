import { apiClient } from "@/lib/api-client";
import type {
  AiAgentDto,
  AiChatResponse,
  AiConversationDto,
  ConfirmActionPayload,
  SendChatPayload,
} from "@/types/ai";

const BASE = "/api/ai";

/**
 * No permission constant here on purpose -- the assistant is "always-on" for any authenticated
 * user, same as web's hasModuleAccess step 2 (dashboard/notifications/ai-assistant bypass the
 * tenant-module and permission checks entirely). Gating it the way every other module is gated
 * would contradict that.
 */
export const aiApi = {
  sendChat: (payload: SendChatPayload): Promise<AiChatResponse> => apiClient.post(`${BASE}/chat`, payload),

  confirmAction: (payload: ConfirmActionPayload): Promise<AiChatResponse> =>
    apiClient.post(`${BASE}/confirm`, payload),

  /** The caller's persisted chat history, so it survives closing and reopening the assistant. */
  getConversation: (): Promise<AiConversationDto> => apiClient.get(`${BASE}/conversation`),

  clearConversation: (): Promise<void> => apiClient.delete(`${BASE}/conversation`),

  getAgents: (): Promise<AiAgentDto[]> => apiClient.get(`${BASE}/agents`),
};
