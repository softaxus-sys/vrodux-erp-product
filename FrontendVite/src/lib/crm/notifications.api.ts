import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/crm/notifications`;

export type CrmNotificationType = "info" | "success" | "warning" | "error" | "mention";

export interface CrmNotificationDto {
  id:            string;
  type:          CrmNotificationType;
  title:         string;
  message:       string;
  /** App-relative path the alert opens, e.g. `/crm/leads?lead={id}`. */
  link:          string | null;
  relatedToType: string | null;
  relatedToId:   string | null;
  read:          boolean;
  createdAt:     string;
}

export interface MyNotificationsDto {
  items:       CrmNotificationDto[];
  unreadCount: number;
}

export const crmNotificationsApi = {
  getMine:     (take = 50): Promise<MyNotificationsDto> => rawApiClient.get(`${BASE}?take=${take}`),
  markRead:    (id: string): Promise<void> => rawApiClient.post(`${BASE}/${id}/read`, {}),
  markAllRead: (): Promise<void> => rawApiClient.post(`${BASE}/read-all`, {}),
};
