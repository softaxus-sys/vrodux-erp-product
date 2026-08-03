import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant/notifications`;

export type NotificationChannel = "sms" | "whatsapp";

export interface NotificationProviderConfigDto {
  channel: NotificationChannel;
  provider: string;
  hasAccountSid: boolean;
  hasAuthToken: boolean;
  fromNumber: string | null;
  isEnabled: boolean;
}

export interface UpsertNotificationProviderConfigRequest {
  channel: NotificationChannel;
  provider: string;
  accountSid?: string | null;
  authToken?: string | null;
  fromNumber?: string | null;
  isEnabled: boolean;
}

export const notificationConfigApi = {
  getConfig: (channel: NotificationChannel): Promise<NotificationProviderConfigDto> =>
    rawApiClient.get(`${BASE}/${channel}`),

  upsertConfig: (req: UpsertNotificationProviderConfigRequest): Promise<NotificationProviderConfigDto> =>
    rawApiClient.put(BASE, req),
};
