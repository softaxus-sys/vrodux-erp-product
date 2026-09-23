import { rawApiClient } from "@/lib/api-client";

/**
 * Cloud Sync — the on-premises installation's nightly push to its read-only cloud mirror.
 * See docs/on-premises-cloud-mirror.md.
 *
 * These endpoints exist in every deployment, but only an on-premises installation has anything to
 * report: on a cloud tenant `licenceConfigured` is false and the screen says so rather than
 * offering a form that could never do anything.
 */

const BASE = "/api/sync";

export interface SyncTableStatus {
  tableName: string;
  /** Change-tracking version this table has been pushed up to. Null until its first run. */
  lastSyncedVersion: number | null;
  lastSyncedAt: string | null;
  seedCompleted: boolean;
}

export interface CloudSyncSettings {
  enabled: boolean;
  cloudBaseUrl: string;
  /** Local wall-clock time, "HH:mm", in `timeZoneId` — never UTC. */
  runAtLocalTime: string;
  timeZoneId: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  reseedRequired: boolean;
  /** False on a cloud deployment, or an installation with no licence key configured. */
  licenceConfigured: boolean;
  tables: SyncTableStatus[];
}

export interface UpdateCloudSyncRequest {
  enabled: boolean;
  cloudBaseUrl: string;
  runAtLocalTime: string;
  timeZoneId: string;
}

export interface CloudSyncRun {
  id: number;
  startedAt: string;
  /** Null while a run is still in flight, or if the service died mid-run. */
  finishedAt: string | null;
  trigger: "scheduled" | "manual" | string;
  ran: boolean;
  succeeded: boolean;
  tablesProcessed: number;
  tablesFailed: number;
  rowsSent: number;
  message: string | null;
}

export interface CloudSyncRunResult {
  ran: boolean;
  skippedReason: string | null;
  succeeded: boolean;
  rowsSent: number;
  tablesProcessed: number;
  tablesFailed: number;
  failures: { table: string; error: string }[];
}

export const cloudSyncApi = {
  get:      (): Promise<CloudSyncSettings> => rawApiClient.get(`${BASE}/settings`),
  update:   (body: UpdateCloudSyncRequest): Promise<CloudSyncSettings> =>
              rawApiClient.put(`${BASE}/settings`, body),
  runs:     (take = 30): Promise<CloudSyncRun[]> => rawApiClient.get(`${BASE}/runs?take=${take}`),
  runNow:   (): Promise<CloudSyncRunResult> => rawApiClient.post(`${BASE}/run`, {}),
  reseed:   (): Promise<{ cleared: number; message: string }> => rawApiClient.post(`${BASE}/reseed`, {}),
};

/**
 * Time zones offered in the picker. Deliberately a short list of the ones this product is actually
 * deployed in, plus whatever the installation already has — a full IANA list is 400 entries of
 * which one is right, and the server validates the value anyway.
 */
export const SYNC_TIME_ZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Qatar",
  "Asia/Kuwait", "Asia/Muscat", "Asia/Bahrain", "Europe/London", "UTC",
];
