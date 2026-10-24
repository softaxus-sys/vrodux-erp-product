import { apiClient, rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

export type BranchServerState = "ok" | "warning" | "error" | "offline" | "never" | "not_configured";

/** Head office's view of one branch server (GET /api/sync/branches, cloud only). */
export interface BranchServerStatusDto {
  branchId: string;
  name: string;
  serverMode: "local" | "cloud";
  configured: boolean;
  state: BranchServerState;
  summary: string;
  lastSeenAt: string | null;
  lastUpOkAt: string | null;
  lastDownOkAt: string | null;
  version: string | null;
  cloudVersion: string;
  versionMatches: boolean;
  clockDriftSeconds: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  failingSince: string | null;
  upRowsTotal: number;
  downRowsTotal: number;
  pendingOrders: number;
  pendingInstructions: number;
  rejectedOrdersToday: number;
  offlineAlertAt: string | null;
  activeKeys: number;
  keyHint: string | null;
  keyCreatedAt: string | null;
  keyLastUsedAt: string | null;
  /** The branch also has a key in server configuration, which this screen cannot revoke. */
  keyInConfig: boolean;
}

/** Shown once, straight after issuing. */
export interface IssuedBranchKeyDto {
  branchId: string;
  key: string;
  connectionCode: string;
  cloudBaseUrl: string;
  hint: string;
}

const ROOT = getApiBaseUrl();

export const branchServersApi = {
  getStatus: (): Promise<BranchServerStatusDto[]> => rawApiClient.get(`${ROOT}/api/sync/branches`),
  /** "local" = the branch runs its own server and owns its bills; "cloud" = tills talk to head office directly. */
  setServerMode: (branchId: string, mode: "local" | "cloud"): Promise<unknown> =>
    apiClient.put(`${ROOT}/api/branches/${branchId}/server-mode`, { mode }),
  issueKey: (branchId: string): Promise<IssuedBranchKeyDto> => rawApiClient.post(`${ROOT}/api/sync/branches/${branchId}/key`, {}),
  revokeKeys: (branchId: string): Promise<{ revoked: number; stillInConfig: boolean }> =>
    rawApiClient.delete(`${ROOT}/api/sync/branches/${branchId}/key`),
};
