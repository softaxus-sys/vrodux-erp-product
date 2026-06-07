import * as React from "react";
import { printApi } from "@/lib/pos/print.api";

export type NetworkPrinterStatus = "checking" | "ready" | "unreachable" | "error";

export interface NetworkPrinterHook {
  status:  NetworkPrinterStatus;
  error:   string | null;
  /** Send raw ESC/POS bytes to the network printer. */
  send:    (data: Uint8Array) => Promise<void>;
  /** Re-check printer reachability. */
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 30_000; // re-check every 30 s

export function useNetworkPrinter(): NetworkPrinterHook {
  const [status, setStatus] = React.useState<NetworkPrinterStatus>("checking");
  const [error,  setError]  = React.useState<string | null>(null);

  const check = React.useCallback(async () => {
    try {
      const res = await printApi.getStatus();
      setStatus(res.reachable ? "ready" : "unreachable");
      setError(res.reachable ? null : (res.message ?? "Printer not reachable"));
    } catch {
      setStatus("unreachable");
      setError("Could not reach print service.");
    }
  }, []);

  // Initial check + periodic poll
  React.useEffect(() => {
    check();
    const t = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [check]);

  const send = React.useCallback(async (data: Uint8Array): Promise<void> => {
    const res = await printApi.printRaw(data);
    if (!res.success) throw new Error(res.message);
  }, []);

  return { status, error, send, refresh: check };
}
