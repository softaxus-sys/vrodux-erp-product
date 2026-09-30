import { apiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/tenant-settings`;

/**
 * Self-service tenant settings (current tenant, resolved from JWT). Uses the Identity
 * apiClient (unwraps the { success, data } envelope) — endpoints live on the Identity service.
 */
export const tenantSettingsApi = {
  updateCurrency: (currency: string): Promise<{ id: string; currency?: string | null }> =>
    apiClient.put(`${BASE}/currency`, { currency }),
};
