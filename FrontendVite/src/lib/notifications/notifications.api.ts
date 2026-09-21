import { rawApiClient } from "@/lib/api-client";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API_ROOT}/api/notifications`;

/** The realtime channel. Hosted by the gateway, not a service — the feed spans every module. */
export const NOTIFICATIONS_HUB_URL = `${API_ROOT}/hubs/notifications`;

export type NotificationType = "info" | "success" | "warning" | "error" | "mention";

export interface NotificationDto {
  id:            string;
  /** Module key — drives the icon and accent colour, and matches the backend's NotificationModules. */
  module:        string;
  /** Stable dotted key, e.g. "lead.assigned". Safe to switch on; the title is prose and is not. */
  event:         string;
  type:          NotificationType;
  title:         string;
  message:       string;
  /** App-relative path this opens. */
  link:          string | null;
  relatedToType: string | null;
  relatedToId:   string | null;
  read:          boolean;
  createdAt:     string;
}

export interface NotificationFeedDto {
  items:       NotificationDto[];
  /** Unread across EVERY module, so the badge does not drop when the panel is filtered. */
  unreadCount: number;
}

export interface ModuleUnreadDto {
  module: string;
  count:  number;
}

export const notificationsApi = {
  getMine: (params?: { take?: number; module?: string; unreadOnly?: boolean }): Promise<NotificationFeedDto> => {
    const q = new URLSearchParams();
    q.set("take", String(params?.take ?? 50));
    if (params?.module) q.set("module", params.module);
    if (params?.unreadOnly) q.set("unreadOnly", "true");
    return rawApiClient.get(`${BASE}?${q.toString()}`);
  },
  summary:     (): Promise<ModuleUnreadDto[]> => rawApiClient.get(`${BASE}/summary`),
  markRead:    (id: string): Promise<void> => rawApiClient.post(`${BASE}/${id}/read`, {}),
  markAllRead: (): Promise<void> => rawApiClient.post(`${BASE}/read-all`, {}),
  dismiss:     (id: string): Promise<void> => rawApiClient.delete(`${BASE}/${id}`),
};
