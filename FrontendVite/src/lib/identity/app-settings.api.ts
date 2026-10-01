import { apiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/app-settings`;

export type SettingsCategory = Record<string, string>;
export type AllSettings = Record<string, SettingsCategory>;

export const appSettingsApi = {
  /** GET /api/app-settings — all categories */
  getAll: (): Promise<AllSettings> =>
    apiClient.get(BASE),

  /** GET /api/app-settings/{category} — one category */
  getCategory: (category: string): Promise<SettingsCategory> =>
    apiClient.get(`${BASE}/${category}`),

  /** PUT /api/app-settings/{category} — upsert one category */
  saveCategory: (category: string, values: SettingsCategory): Promise<SettingsCategory> =>
    apiClient.put(`${BASE}/${category}`, values),

  /** PUT /api/app-settings — save all categories at once */
  saveAll: (settings: AllSettings): Promise<void> =>
    apiClient.put(BASE, settings),
};
