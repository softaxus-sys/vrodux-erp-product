import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/tenant-settings`;

/**
 * Self-service tenant settings (current tenant, resolved from JWT). Uses the Identity
 * apiClient (unwraps the { success, data } envelope) — endpoints live on the Identity service.
 */
export const tenantSettingsApi = {
  updateCurrency: (currency: string): Promise<{ id: string; currency?: string | null }> =>
    apiClient.put(`${BASE}/currency`, { currency }),
};
