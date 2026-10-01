import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/tenant-settings`;

/** This tenant's own usage of the shared object-storage bucket against their plan's budget. */
export interface TenantStorageStatusDto {
  plan: string;
  usedBytes: number;
  budgetBytes: number;
  percentUsed: number;
  /** True once usage is at/over 90% of the budget — drives the "approaching your limit" warning. */
  nearBudget: boolean;
  unlimited: boolean;
}

/**
 * Self-service tenant settings (current tenant, resolved from JWT). Uses the Identity
 * apiClient (unwraps the { success, data } envelope) — endpoints live on the Identity service.
 */
export const tenantSettingsApi = {
  updateCurrency: (currency: string): Promise<{ id: string; currency?: string | null }> =>
    apiClient.put(`${BASE}/currency`, { currency }),

  getStorageUsage: (): Promise<TenantStorageStatusDto> =>
    apiClient.get(`${BASE}/storage`),
};
