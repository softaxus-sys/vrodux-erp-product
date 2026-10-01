import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/restaurant/notifications`;

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
