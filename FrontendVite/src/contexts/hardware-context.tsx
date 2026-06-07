/**
 * HardwareContext — provides network printer, cash drawer state, and barcode
 * scanner status to all POS components.
 *
 * Printer mode: NETWORK (TCP/IP via backend proxy)
 *   The receipt printer is connected to the local network through a router.
 *   Since browsers cannot open raw TCP sockets, the frontend sends ESC/POS
 *   bytes to POST /api/pos/print/raw, and the backend forwards them to the
 *   printer's IP:9100 via TcpClient.
 *
 *   Printer IP / port are configured in the backend appsettings.json under
 *   "PrinterSettings": { "IpAddress": "...", "Port": 9100 }.
 *
 * Cash drawer:
 *   The drawer is connected to the RJ11/RJ12 port on the receipt printer.
 *   openDrawer() sends the ESC p command via the network print API.
 *   Since we can't poll drawer status over TCP (one-way), the user must click
 *   "Mark Closed" manually if the drawer guard blocks the next transaction.
 */

import * as React from "react";
import { useNetworkPrinter, type NetworkPrinterStatus } from "@/hooks/pos/use-network-printer";
import { EscPos } from "@/lib/pos/escpos";

// ── Public shape ─────────────────────────────────────────────────────────────

export type PrinterStatus = NetworkPrinterStatus;

export interface HardwareContextValue {
  // ── Printer ────────────────────────────────────────────────────────────────
  /** "checking" | "ready" | "unreachable" | "error" */
  printerStatus:      PrinterStatus;
  printerError:       string | null;
  /** Always false — network mode has no WebUSB requirement */
  isWebUsbSupported:  boolean;
  /** No-op in network mode (no pairing needed) */
  connectPrinter:     () => Promise<void>;
  /** No-op in network mode */
  disconnectPrinter:  () => void;
  /** Send raw ESC/POS bytes → POST /api/pos/print/raw → TCP to printer */
  printRaw:           (data: Uint8Array) => Promise<void>;
  /** Re-check printer reachability */
  refreshPrinter:     () => Promise<void>;

  // ── Cash drawer ───────────────────────────────────────────────────────────
  drawerIsOpen:       boolean;
  openDrawer:         () => Promise<void>;
  markDrawerClosed:   () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const HardwareContext = React.createContext<HardwareContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const printer = useNetworkPrinter();

  const [drawerIsOpen, setDrawerIsOpen] = React.useState(false);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Send the ESC p (open drawer) command via the network print API.
   * Network printers don't support bidirectional status queries, so we mark
   * the drawer open optimistically and require manual "Mark Closed" reset.
   */
  const openDrawer = React.useCallback(async (): Promise<void> => {
    try {
      // Pulse BOTH drawer pins (2 and 5) — different cash drawers are wired to
      // different pins; sending both guarantees the kick reaches the drawer.
      const cmd = new EscPos().openDrawerPin2().openDrawerPin5().build();
      await printer.send(cmd);
    } catch {
      // Non-fatal — drawer may still open if the printer received the command
    }
    setDrawerIsOpen(true);
  }, [printer]);

  const markDrawerClosed = React.useCallback((): void => {
    setDrawerIsOpen(false);
  }, []);

  const value: HardwareContextValue = {
    printerStatus:     printer.status,
    printerError:      printer.error,
    isWebUsbSupported: false,          // not applicable in network mode
    connectPrinter:    async () => { await printer.refresh(); },
    disconnectPrinter: () => {},       // no persistent connection to close
    printRaw:          printer.send,
    refreshPrinter:    printer.refresh,
    drawerIsOpen,
    openDrawer,
    markDrawerClosed,
  };

  return (
    <HardwareContext.Provider value={value}>
      {children}
    </HardwareContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useHardware(): HardwareContextValue {
  const ctx = React.useContext(HardwareContext);
  if (!ctx) throw new Error("useHardware() must be called inside <HardwareProvider>.");
  return ctx;
}
