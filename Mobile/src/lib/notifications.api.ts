import { apiClient } from "@/lib/api-client";
import type { MyNotificationsDto } from "@/types/notifications";

const BASE = "/api/crm/notifications";

export const notificationsApi = {
  getMine: (take = 50): Promise<MyNotificationsDto> => apiClient.get(`${BASE}?take=${take}`),
  markRead: (id: string): Promise<void> => apiClient.post(`${BASE}/${id}/read`),
  markAllRead: (): Promise<void> => apiClient.post(`${BASE}/read-all`),
};
