/**
 * HardwareStatusBar — compact status indicators for POS hardware.
 * Shows network printer connection state, cash drawer status, and barcode scanner.
 * Renders in the POS header.
 */

import * as React from "react";
import { Printer, Loader2, Scan, Zap, AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHardware } from "@/contexts/hardware-context";
import type { PrinterStatus } from "@/contexts/hardware-context";

// ── Status metadata ───────────────────────────────────────────────────────────

interface StatusMeta {
  label:   string;
  dot:     string;
  text:    string;
  ring:    string;
  animate: boolean;
  icon:    React.ElementType;
}

const PRINTER_META: Record<PrinterStatus, StatusMeta> = {
  checking: {
    label:   "Connecting…",
    dot:     "bg-amber-400",
    text:    "text-amber-600",
    ring:    "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
    animate: true,
    icon:    Loader2,
  },
  ready: {
    label:   "Printer Ready",
    dot:     "bg-emerald-500",
    text:    "text-emerald-600",
    ring:    "border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20",
    animate: true,
    icon:    Wifi,
  },
  unreachable: {
    label:   "Printer Offline",
    dot:     "bg-red-500",
    text:    "text-red-600",
    ring:    "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
    animate: false,
    icon:    WifiOff,
  },
  error: {
    label:   "Printer Error",
    dot:     "bg-red-500",
    text:    "text-red-600",
    ring:    "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
    animate: false,
    icon:    AlertTriangle,
  },
};

// ── Components ────────────────────────────────────────────────────────────────

export function HardwareStatusBar() {
  const {
    printerStatus,
    printerError,
    refreshPrinter,
    drawerIsOpen,
  } = useHardware();

  const meta = PRINTER_META[printerStatus];
  const Icon = meta.icon;

  const isOffline = printerStatus === "unreachable" || printerStatus === "error";

  return (
    <div className="flex items-center gap-1.5">

      {/* Barcode scanner — always ready (HID keyboard mode, no setup needed) */}
      <div className={cn(
        "hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold",
        "border-emerald-200 bg-emerald-50 text-emerald-600",
        "dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
      )}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <Scan className="h-3 w-3 shrink-0" />
        <span>Scanner</span>
      </div>

      {/* Network printer status */}
      <button
        onClick={isOffline ? refreshPrinter : undefined}
        disabled={printerStatus === "checking"}
        title={
          printerStatus === "ready"
            ? "Network printer connected — click does nothing"
            : printerError ?? "Click to retry connection"
        }
        className={cn(
          "hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors",
          meta.ring, meta.text,
          isOffline ? "cursor-pointer hover:opacity-80" : "cursor-default"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dot, meta.animate && "animate-pulse")} />
        <Icon className={cn("h-3 w-3 shrink-0", printerStatus === "checking" && "animate-spin")} />
        <span>{meta.label}</span>
        {isOffline && <RefreshCw className="h-2.5 w-2.5 shrink-0 ml-0.5" />}
      </button>

      {/* Cash drawer status — only show when open */}
      {drawerIsOpen && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-700 text-[10px] font-bold animate-pulse dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
          <Zap className="h-3 w-3 shrink-0" />
          <span>DRAWER OPEN</span>
        </div>
      )}
    </div>
  );
}
