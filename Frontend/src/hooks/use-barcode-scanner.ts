"use client";

import * as React from "react";

export interface BarcodeScanResult {
  barcode: string;
  timestamp: number;
}

interface UseBarcodeScannerOptions {
  /** Called when a valid barcode scan is detected */
  onScan: (result: BarcodeScanResult) => void;
  /** Whether the scanner is active (default: true) */
  enabled?: boolean;
  /** Minimum barcode length to trigger onScan (default: 4) */
  minLength?: number;
  /**
   * Maximum ms between keystrokes to be considered scanner input.
   * Human typing is ~100–200ms; scanners fire at 10–40ms.
   * Default: 60ms
   */
  maxKeystrokeInterval?: number;
}

/**
 * useBarcodeScanner
 *
 * Detects input from a USB/Bluetooth HID barcode scanner.
 * Scanners send characters extremely fast (each keystroke < 60ms apart)
 * and terminate the barcode with an Enter key.
 *
 * The hook ignores keystrokes that originate inside <input>, <textarea>,
 * or contentEditable elements so it never interferes with user typing.
 *
 * Usage:
 *   useBarcodeScanner({
 *     onScan: ({ barcode }) => addToCart(findProduct(barcode)),
 *   });
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxKeystrokeInterval = 60,
}: UseBarcodeScannerOptions): void {
  const bufferRef      = React.useRef<string>("");
  const lastKeyTimeRef = React.useRef<number>(0);
  const clearTimerRef  = React.useRef<number | undefined>(undefined);

  // Stable reference so effect doesn't re-run when caller re-renders
  const onScanRef = React.useRef(onScan);
  React.useLayoutEffect(() => { onScanRef.current = onScan; });

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focus is inside a text input — let normal typing work
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "INPUT"    ||
        tag === "TEXTAREA" ||
        tag === "SELECT"   ||
        target.isContentEditable
      ) return;

      const now     = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Keystrokes too slow → human typing, not a scanner; reset buffer
      if (elapsed > maxKeystrokeInterval && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code.length >= minLength) {
          onScanRef.current({ barcode: code, timestamp: now });
        }
        bufferRef.current = "";
        window.clearTimeout(clearTimerRef.current);
        return;
      }

      // Accumulate printable characters only
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Safety: auto-clear buffer after 400 ms of inactivity
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        bufferRef.current = "";
      }, 400);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(clearTimerRef.current);
    };
  }, [enabled, minLength, maxKeystrokeInterval]);
}
