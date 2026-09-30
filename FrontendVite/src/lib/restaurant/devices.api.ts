import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/restaurant/devices`;

export interface DeviceRegistrationDto {
  id: string;
  branchId: string | null;
  deviceName: string;
  deviceFingerprint: string;
  registeredByUserId: string;
  lastSeenAt: string;
  isActive: boolean;
  createdAt: string;
}

export const devicesApi = {
  register: (p: { branchId: string | null; deviceFingerprint: string; deviceName: string }): Promise<DeviceRegistrationDto> =>
    rawApiClient.post(`${BASE}/register`, p),

  heartbeat: (deviceFingerprint: string): Promise<void> =>
    rawApiClient.post(`${BASE}/heartbeat`, { deviceFingerprint }),

  getAll: (branchId?: string | null): Promise<DeviceRegistrationDto[]> =>
    rawApiClient.get(`${BASE}${branchId ? `?branchId=${branchId}` : ""}`),

  update: (id: string, p: { deviceName: string; branchId: string | null; isActive: boolean }): Promise<DeviceRegistrationDto> =>
    rawApiClient.put(`${BASE}/${id}`, p),

  remove: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/${id}`),
};
