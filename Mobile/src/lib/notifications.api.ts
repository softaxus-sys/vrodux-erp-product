import { apiClient } from "@/lib/api-client";
import type { ModuleUnreadDto, MyNotificationsDto } from "@/types/notifications";

/** Gateway-hosted, cross-module feed -- see types/notifications.ts for why this replaced the old
 *  CRM-only `/api/crm/notifications`. */
const BASE = "/api/notifications";

export const notificationsApi = {
  getMine: (params?: { take?: number; module?: string; unreadOnly?: boolean }): Promise<MyNotificationsDto> => {
    const q = new URLSearchParams();
    q.set("take", String(params?.take ?? 50));
    if (params?.module) q.set("module", params.module);
    if (params?.unreadOnly) q.set("unreadOnly", "true");
    return apiClient.get(`${BASE}?${q.toString()}`);
  },
  summary:     (): Promise<ModuleUnreadDto[]> => apiClient.get(`${BASE}/summary`),
  markRead:    (id: string): Promise<void> => apiClient.post(`${BASE}/${id}/read`),
  markAllRead: (): Promise<void> => apiClient.post(`${BASE}/read-all`),
  dismiss:     (id: string): Promise<void> => apiClient.delete(`${BASE}/${id}`),
};
