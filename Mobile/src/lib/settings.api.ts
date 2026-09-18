import { apiClient } from "@/lib/api-client";
import type {
  ChangeMyPasswordRequest,
  TwoFactorEnableResultDto,
  TwoFactorSetupDto,
  TwoFactorStatusDto,
  UpdateMeRequest,
} from "@/types/settings";
import type { UserDto } from "@/types/auth";

const AUTH_BASE = "/api/auth";
const TWO_FACTOR_BASE = "/api/account/2fa";

export const accountApi = {
  getMe: (): Promise<UserDto> => apiClient.get(`${AUTH_BASE}/me`),
  updateMe: (body: UpdateMeRequest): Promise<UserDto> => apiClient.put(`${AUTH_BASE}/me`, body),
  changePassword: (body: ChangeMyPasswordRequest): Promise<void> => apiClient.post(`${AUTH_BASE}/me/change-password`, body),
};

export const twoFactorApi = {
  getStatus: (): Promise<TwoFactorStatusDto> => apiClient.get(`${TWO_FACTOR_BASE}/status`),
  setup: (): Promise<TwoFactorSetupDto> => apiClient.post(`${TWO_FACTOR_BASE}/setup`),
  enable: (code: string): Promise<TwoFactorEnableResultDto> => apiClient.post(`${TWO_FACTOR_BASE}/enable`, { code }),
  disable: (code: string): Promise<void> => apiClient.post(`${TWO_FACTOR_BASE}/disable`, { code }),
};
