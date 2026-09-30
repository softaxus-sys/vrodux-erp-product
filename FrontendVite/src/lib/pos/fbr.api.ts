import { apiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/pos/fbr`;

export type FbrEnvironment = "sandbox" | "production";

export interface FbrQueueItem {
  id:                string;
  transactionNumber: string;
  completedAt:       string;
  totalAmount:       number;
  status:            "pending" | "failed";
  attempts:          number;
  lastError:         string | null;
  nextAttemptAt:     string | null;
}

/** FBR settings as the server returns them - the token itself is never sent back. */
export interface FbrSettings {
  enabled:        boolean;
  environment:    FbrEnvironment;
  posId:          number | null;
  hasToken:       boolean;
  serviceFee:     number;
  defaultPctCode: string | null;
  pending:        number;
  submitted:      number;
  failed:         number;
  unsubmitted:    FbrQueueItem[];
}

export interface SaveFbrSettings {
  enabled:        boolean;
  environment:    FbrEnvironment;
  posId:          number | null;
  /** New token, or omit / empty to keep the stored one. */
  token?:         string | null;
  serviceFee:     number;
  defaultPctCode: string | null;
}

export interface FbrTestResult {
  success:          boolean;
  message:          string;
  fbrInvoiceNumber: string | null;
}

export const fbrApi = {
  get:   (): Promise<FbrSettings> => apiClient.get<FbrSettings>(BASE),
  save:  (body: SaveFbrSettings): Promise<FbrSettings> => apiClient.put<FbrSettings>(BASE, body),
  test:  (): Promise<FbrTestResult> => apiClient.post<FbrTestResult>(`${BASE}/test`, {}),
  /** Re-queue one failed sale, or every failed sale when no id is given. */
  retry: (transactionId?: string): Promise<number> =>
    apiClient.post<number>(`${BASE}/retry${transactionId ? `?transactionId=${transactionId}` : ""}`, {}),
};
