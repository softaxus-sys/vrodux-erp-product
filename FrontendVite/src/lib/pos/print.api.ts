import { rawApiClient } from "@/lib/api-client";

// PrintController answers with plain objects ({ success, message } / { reachable, … }), not the
// { success, data } envelope — apiClient would return body.data (undefined) and read every
// status as a failure, so these calls use the raw client.
const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/pos/print`;

export type PrinterMode = "windows" | "network";

/** What Settings -> Receipt Printer needs: installed printers + saved / file / auto-detected choice. */
export interface PrinterInfo {
  printers:     string[];
  autoDetected: string | null;
  savedMode:    PrinterMode | null;
  savedName:    string | null;
  savedIp:      string | null;
  savedPort:    number | null;
  fileMode:     string;
  fileName:     string;
  fileIp:       string;
  filePort:     number;
  isWindows:    boolean;
}

export interface PrinterChoice {
  mode:         PrinterMode;
  printerName?: string | null;
  printerIp?:   string | null;
  printerPort?: number | null;
}

export const printApi = {
  /**
   * Send raw ESC/POS bytes to the printer via the backend proxy
   * (Windows spooler or network TCP, per the saved printer choice).
   */
  printRaw: (data: Uint8Array): Promise<{ success: boolean; message: string }> =>
    rawApiClient.post(`${BASE}/raw`, {
      data: btoa(String.fromCharCode(...data)),
    }),

  /** Check whether the configured printer is reachable. */
  getStatus: (): Promise<{ reachable: boolean; mode?: string; printer?: string; ip: string; port: number; message?: string }> =>
    rawApiClient.get(`${BASE}/status`),

  /** Printers installed on the server PC, and the current choice. */
  getPrinters: (): Promise<PrinterInfo> => rawApiClient.get(`${BASE}/printers`),

  /** Save the receipt printer for this store. */
  saveSettings: (c: PrinterChoice): Promise<{ success: boolean; message: string }> =>
    rawApiClient.put(`${BASE}/settings`, {
      mode: c.mode, printerName: c.printerName ?? null, printerIp: c.printerIp ?? null, printerPort: c.printerPort ?? null,
    }),

  /** Print a short test slip on the given (unsaved) choice, or the saved printer when omitted. */
  testPrint: (c?: PrinterChoice): Promise<{ success: boolean; message: string }> =>
    rawApiClient.post(`${BASE}/test`, c
      ? { mode: c.mode, printerName: c.printerName ?? null, printerIp: c.printerIp ?? null, printerPort: c.printerPort ?? null }
      : {}),
};
