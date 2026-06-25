import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/pos/print`;


export const printApi = {
  /**
   * Send raw ESC/POS bytes to the printer via the backend proxy
   * (Windows spooler or network TCP, per backend PrinterSettings).
   */
  printRaw: (data: Uint8Array): Promise<{ success: boolean; message: string }> =>
    apiClient.post(`${BASE}/raw`, {
      data: btoa(String.fromCharCode(...data)),
    }),

  /** Check whether the configured printer is reachable. */
  getStatus: (): Promise<{ reachable: boolean; mode?: string; printer?: string; ip: string; port: number; message?: string }> =>
    apiClient.get(`${BASE}/status`),
};
