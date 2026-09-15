import { apiClient } from "@/lib/api-client";

const BASE = "/api/account/device-tokens";

export interface RegisterDeviceTokenPayload {
  expoPushToken: string;
  platform: "ios" | "android";
  deviceName?: string;
}

export const deviceTokensApi = {
  register: (payload: RegisterDeviceTokenPayload): Promise<void> => apiClient.post(BASE, payload),
  unregister: (expoPushToken: string): Promise<void> =>
    apiClient.post(`${BASE}/unregister`, { expoPushToken }),
};
