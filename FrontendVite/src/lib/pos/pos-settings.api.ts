import { apiClient } from "@/lib/api-client";

const API  = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api`;
const BASE = `${API}/pos-settings`;

export interface PosSettingsDto {
  offlineModeEnabled: boolean;
}

export interface OpenShiftBlockerDto {
  sessionId:  string;
  registerId: string;
  cashierId:  string;
  openedAt:   string;
}

export interface TillBlockerDto {
  deviceId:       string;
  registerId:     string | null;
  userName:       string | null;
  pendingRecords: number;
  unsyncedShifts: number;
  reportedAt:     string;
}

/** What stands between the tenant and switching modes. Switching only happens with nothing in flight. */
export interface SwitchReadinessDto {
  offlineModeEnabled:    boolean;
  canSwitch:             boolean;
  openOnlineShifts:      OpenShiftBlockerDto[];
  openOfflineShifts:     OpenShiftBlockerDto[];
  tillsWithUnsyncedWork: TillBlockerDto[];
}

export const posSettingsApi = {
  get:          (): Promise<PosSettingsDto> => apiClient.get<PosSettingsDto>(BASE),
  getReadiness: (): Promise<SwitchReadinessDto> => apiClient.get<SwitchReadinessDto>(`${BASE}/switch-readiness`),
  update: (payload: { offlineModeEnabled: boolean; force?: boolean }): Promise<PosSettingsDto> =>
    apiClient.put<PosSettingsDto>(BASE, payload),

  reportTillStatus: (payload: {
    deviceId: string; registerId: string | null; pendingRecords: number; unsyncedShifts: number;
  }): Promise<TillBlockerDto> => apiClient.post<TillBlockerDto>(`${API}/pos-offline/till-status`, payload),
};
