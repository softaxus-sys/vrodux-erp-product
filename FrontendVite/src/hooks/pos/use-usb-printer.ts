/**
 * useUsbPrinter — WebUSB-based thermal receipt printer hook.
 *
 * Works in Chrome 61+ and Edge 79+ for both cloud and on-premises deployments.
 * Requires HTTPS or localhost (browser security requirement for WebUSB).
 *
 * Supported hardware: Epson TM-T20/T82/T88, Star mC-Print, Bixolon SRP,
 * Xprinter XP-series, and any ESC/POS-compatible USB thermal printer.
 *
 * Cash drawer notes:
 *   The cash drawer is NOT connected to the PC USB port.
 *   It connects via an RJ11/RJ12 cable to the DK (cash drawer kick) port
 *   on the back of the receipt printer. The printer pulses the drawer open
 *   when it receives the ESC p command.
 */

import * as React from "react";
import { EscPos } from "@/lib/pos/escpos";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrinterStatus =
  | "disconnected" // no device connected
  | "connecting"   // requestDevice pending
  | "ready"        // connected and idle
  | "printing"     // transferOut in progress
  | "error";       // last operation failed

export interface UsbPrinterHook {
  /** Current printer state */
  status:          PrinterStatus;
  /** Last error message, or null */
  error:           string | null;
  /** True when the browser supports WebUSB (Chrome / Edge) */
  isWebUsbSupported: boolean;
  /** Open Chrome USB device picker and claim the printer */
  connect:         () => Promise<void>;
  /** Release the device */
  disconnect:      () => void;
  /** Send raw ESC/POS bytes to the printer */
  send:            (data: Uint8Array) => Promise<void>;
  /** Send ESC p to open cash drawer (both pin 2 and pin 5 for compatibility) */
  openDrawer:      () => Promise<void>;
  /**
   * Query cash drawer status via DLE EOT.
   * Returns true = open, false = closed, null = printer doesn't support it.
   */
  getDrawerOpen:   () => Promise<boolean | null>;
}

// ── USB endpoint conventions for most ESC/POS printers ───────────────────────
const OUT_ENDPOINT = 1; // Bulk OUT — we write receipt data here
const IN_ENDPOINT  = 2; // Bulk IN  — we read status responses here

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useUsbPrinter(): UsbPrinterHook {
  const [status, setStatus] = React.useState<PrinterStatus>("disconnected");
  const [error,  setError]  = React.useState<string | null>(null);

  const deviceRef = React.useRef<USBDevice | null>(null);
  const ifaceRef  = React.useRef<number>(OUT_ENDPOINT);
  const inEpRef   = React.useRef<number>(IN_ENDPOINT);

  const isWebUsbSupported: boolean =
    typeof navigator !== "undefined" && !!navigator.usb;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const rawSend = React.useCallback(async (data: Uint8Array): Promise<void> => {
    const device = deviceRef.current;
    if (!device) throw new Error("Printer not connected.");
    await device.transferOut(ifaceRef.current, data);
  }, []);

  // ── Shared claim logic (used by both connect flows) ────────────────────────

  const claimDevice = React.useCallback(async (device: USBDevice): Promise<void> => {
    if (device.configuration === null) await device.selectConfiguration(1);

    const cfg   = device.configuration;
    const iface = cfg?.interfaces.find(i => {
      const alt = i.alternates[0];
      return alt?.interfaceClass === 0x07 || alt?.interfaceClass === 0xFF;
    }) ?? cfg?.interfaces[0];

    if (!iface) throw new Error("No printer interface found on this USB device.");

    const alt   = iface.alternates[0];
    const outEp = alt?.endpoints.find(e => e.direction === "out" && e.type === "bulk");
    const inEp  = alt?.endpoints.find(e => e.direction === "in"  && e.type === "bulk");

    await device.claimInterface(iface.interfaceNumber);

    deviceRef.current = device;
    ifaceRef.current  = outEp?.endpointNumber ?? OUT_ENDPOINT;
    inEpRef.current   = inEp?.endpointNumber  ?? IN_ENDPOINT;
  }, []);

  // ── Auto-reconnect previously authorised printer on mount ─────────────────
  // navigator.usb.getDevices() returns devices the user already granted access
  // to in a previous session — no picker dialog needed.

  React.useEffect(() => {
    if (!isWebUsbSupported || deviceRef.current) return;

    navigator.usb!.getDevices().then(async (devices) => {
      // Pick the first device that looks like a printer (class 0x07 or 0xFF)
      const printer = devices.find(d =>
        d.configuration?.interfaces.some(i => {
          const alt = i.alternates[0];
          return alt?.interfaceClass === 0x07 || alt?.interfaceClass === 0xFF;
        })
      ) ?? devices[0]; // fall back to first authorised device

      if (!printer) return;

      try {
        setStatus("connecting");
        await printer.open();
        await claimDevice(printer);
        setStatus("ready");
      } catch {
        // Device may be in use by another tab or powered off — stay disconnected
        deviceRef.current = null;
        setStatus("disconnected");
      }
    }).catch(() => { /* getDevices not available — ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebUsbSupported]); // run once on mount

  // ── Connect (manual — shows USB device picker) ─────────────────────────────

  const connect = React.useCallback(async (): Promise<void> => {
    if (!isWebUsbSupported) {
      setError("WebUSB is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (deviceRef.current) {
      setStatus("ready");
      return;
    }

    try {
      setStatus("connecting");
      setError(null);

      // No vendor filter — show all USB devices so any ESC/POS printer works
      const device = await navigator.usb!.requestDevice({ filters: [] });
      await device.open();
      await claimDevice(device);
      setStatus("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // "No device selected" = user clicked Cancel — not an error
      if (msg.toLowerCase().includes("no device selected") ||
          msg.toLowerCase().includes("cancelled")) {
        setStatus("disconnected");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }, [isWebUsbSupported, claimDevice]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = React.useCallback((): void => {
    deviceRef.current?.close().catch(() => {/* ignore */});
    deviceRef.current = null;
    setStatus("disconnected");
    setError(null);
  }, []);

  // ── Send data ──────────────────────────────────────────────────────────────

  const send = React.useCallback(async (data: Uint8Array): Promise<void> => {
    setStatus("printing");
    try {
      await rawSend(data);
      setStatus("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Print failed.";
      setStatus("error");
      setError(msg);
      throw err;
    }
  }, [rawSend]);

  // ── Cash drawer ────────────────────────────────────────────────────────────

  const openDrawer = React.useCallback(async (): Promise<void> => {
    const cmd = new EscPos().openDrawerPin2().build();
    try {
      await rawSend(cmd);
    } catch {
      // Drawer command failure is non-fatal — printer may not support it
      // or the drawer may not be wired. Log in dev only.
      if (import.meta.env.DEV) {
        console.warn("[POS] Cash drawer open command failed (non-fatal).");
      }
    }
  }, [rawSend]);

  const getDrawerOpen = React.useCallback(async (): Promise<boolean | null> => {
    const device = deviceRef.current;
    if (!device || status !== "ready") return null;

    try {
      await device.transferOut(ifaceRef.current, EscPos.QUERY_DRAWER_STATUS);

      // Some printers take a moment to respond
      await new Promise(r => setTimeout(r, 50));

      const result = await device.transferIn(inEpRef.current, 1);

      if (!result.data || result.data.byteLength === 0) return null;
      const byte = result.data.getUint8(0);
      return (byte & 0x04) !== 0; // bit 2 = 1 → open
    } catch {
      // Printer doesn't support bidirectional status query
      return null;
    }
  }, [status]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      deviceRef.current?.close().catch(() => {});
    };
  }, []);

  return {
    status,
    error,
    isWebUsbSupported,
    connect,
    disconnect,
    send,
    openDrawer,
    getDrawerOpen,
  };
}
