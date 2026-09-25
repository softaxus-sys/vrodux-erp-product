import { rawApiClient } from "@/lib/api-client";

// PrintController answers with plain objects ({ success, message } / { reachable, … }), not the
// { success, data } envelope — apiClient would return body.data (undefined) and read every
// status as a failure, so these calls use the raw client.

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/pos/print`;


export const printApi = {
  /**
   * Send raw ESC/POS bytes to the printer via the backend proxy
   * (Windows spooler or network TCP, per backend PrinterSettings).
   */
  printRaw: (data: Uint8Array): Promise<{ success: boolean; message: string }> =>
    rawApiClient.post(`${BASE}/raw`, {
      data: btoa(String.fromCharCode(...data)),
    }),

  /** Check whether the configured printer is reachable. */
  getStatus: (): Promise<{ reachable: boolean; mode?: string; printer?: string; ip: string; port: number; message?: string }> =>
    rawApiClient.get(`${BASE}/status`),
};
