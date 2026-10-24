import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import type { RestaurantOrder } from "./restaurant.api";

const BASE = `${getApiBaseUrl()}/api/restaurant`;

// ── Tax per country / branch, and FBR ─────────────────────────────────────────

export interface TaxRegionPreset { code: string; name: string; label: string; rate: number; authority: string }
export interface TaxCountryPreset {
  code: string; name: string; currency: string; label: string; rate: number;
  regions: TaxRegionPreset[]; supportsFbr: boolean;
}

export interface TaxProfile {
  id: string | null;
  branchId: string | null;
  countryCode: string;
  regionCode: string | null;
  taxLabel: string;
  ratePercent: number;
  fbrEnabled: boolean;
  fbrEnvironment: "sandbox" | "production";
  fbrPosId: number | null;
  fbrTokenSet: boolean;
  fbrServiceFee: number;
  fbrPctCode: string;
  /** False when nothing is saved yet and the values are the country's preset. */
  isSaved: boolean;
}

export interface TaxSettings {
  workspaceCountry: string | null;
  workspace: TaxProfile;
  branches: TaxProfile[];
  presets: TaxCountryPreset[];
}

export interface SaveTaxProfile {
  countryCode: string;
  regionCode: string | null;
  taxLabel: string;
  ratePercent: number;
  fbrEnabled: boolean;
  fbrEnvironment: "sandbox" | "production";
  fbrPosId: number | null;
  /** Undefined keeps the stored token; an empty string removes it. */
  fbrToken?: string;
  fbrServiceFee: number;
  fbrPctCode: string;
}

export interface CurrentTax { rate: number; label: string; serviceFee: number; reportToFbr: boolean }
export interface FbrTestResult { ok: boolean; message: string; invoiceNumber: string | null }
export interface FbrQueueItem {
  orderId: string; orderNumber: string; total: number; status: string | null; error: string | null;
  attempts: number; invoiceNumber: string | null; createdAt: string; branchId: string | null;
}

const q = (branchId?: string | null) => (branchId ? `?branchId=${branchId}` : "");

export const taxApi = {
  get: (): Promise<TaxSettings> => rawApiClient.get(`${BASE}/tax`),
  current: (branchId?: string | null): Promise<CurrentTax> => rawApiClient.get(`${BASE}/tax/current${q(branchId)}`),
  saveWorkspace: (p: SaveTaxProfile): Promise<TaxProfile> => rawApiClient.put(`${BASE}/tax`, p),
  saveBranch: (branchId: string, p: SaveTaxProfile): Promise<TaxProfile> => rawApiClient.put(`${BASE}/tax/branches/${branchId}`, p),
  deleteBranch: (branchId: string): Promise<void> => rawApiClient.delete(`${BASE}/tax/branches/${branchId}`),
  testFbr: (branchId?: string | null): Promise<FbrTestResult> => rawApiClient.post(`${BASE}/tax/fbr/test${q(branchId)}`, {}),
  fbrQueue: (branchId?: string | null): Promise<FbrQueueItem[]> => rawApiClient.get(`${BASE}/tax/fbr/queue${q(branchId)}`),
  retryFbr: (orderId?: string): Promise<number> =>
    rawApiClient.post(`${BASE}/tax/fbr/retry${orderId ? `?orderId=${orderId}` : ""}`, {}),
};

// ── Online ordering platforms (Foodpanda) ──────────────────────────────────────

export interface PlatformConnection {
  id: string;
  platform: "foodpanda";
  environment: "sandbox" | "production";
  branchId: string;
  remoteId: string;
  username: string | null;
  passwordSet: boolean;
  pluginSecretSet: boolean;
  autoAccept: boolean;
  defaultPrepMinutes: number;
  isEnabled: boolean;
  /** Give this to Foodpanda as the POS plugin URL. */
  pluginBaseUrl: string;
  lastOrderAt: string | null;
  lastError: string | null;
}

export interface SavePlatformConnection {
  platform: "foodpanda";
  environment: "sandbox" | "production";
  branchId: string;
  remoteId: string;
  username: string | null;
  /** Undefined keeps what is stored. */
  password?: string;
  pluginSecret?: string;
  autoAccept: boolean;
  defaultPrepMinutes: number;
  isEnabled: boolean;
}

/** Delivery Hero's rejection reasons, with the words staff see. */
export const REJECT_REASONS = [
  ["TOO_BUSY", "Too busy"],
  ["ITEM_UNAVAILABLE", "Item not available"],
  ["CLOSED", "Restaurant closed"],
  ["OUTSIDE_DELIVERY_AREA", "Outside delivery area"],
  ["ADDRESS_INCOMPLETE_MISSTATED", "Address incomplete"],
  ["TECHNICAL_PROBLEM", "Technical problem"],
] as const;

export const platformsApi = {
  list: (): Promise<PlatformConnection[]> => rawApiClient.get(`${BASE}/platforms`),
  create: (p: SavePlatformConnection): Promise<PlatformConnection> => rawApiClient.post(`${BASE}/platforms`, p),
  update: (id: string, p: SavePlatformConnection): Promise<PlatformConnection> => rawApiClient.put(`${BASE}/platforms/${id}`, p),
  remove: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/platforms/${id}`),
  test: (id: string): Promise<{ ok: boolean; message: string }> => rawApiClient.post(`${BASE}/platforms/${id}/test`, {}),
  accept: (orderId: string, prepMinutes?: number): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/platforms/orders/${orderId}/accept`, { prepMinutes }),
  reject: (orderId: string, reason: string, message?: string): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/platforms/orders/${orderId}/reject`, { reason, message }),
  handOver: (orderId: string): Promise<RestaurantOrder> => rawApiClient.post(`${BASE}/platforms/orders/${orderId}/handover`, {}),
};
