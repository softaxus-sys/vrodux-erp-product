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
  /**
   * When true, intercepts scanner input even when a text input / textarea has
   * keyboard focus. Uses event capture phase so the hook fires before the
   * element receives the keystroke.
   *
   * From the 2nd character onwards, `preventDefault()` is called so scanner
   * characters don't pollute the focused field. The first character may still
   * leak — in product-form contexts this is acceptable because autofill will
   * overwrite Name / Description fields with the correct values.
   *
   * Pass `barcodeInputRef` to exclude the dedicated barcode <input> from
   * interception (its own onKeyDown handler manages the scan).
   *
   * Default: false
   */
  captureFromInputs?: boolean;
  /**
   * Ref to the barcode <input> element. When `captureFromInputs` is true,
   * keystrokes on THIS element are NOT intercepted — the field's own
   * onKeyDown → Enter handler takes over instead.
   */
  barcodeInputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * useBarcodeScanner
 *
 * Detects input from a USB/Bluetooth HID barcode scanner.
 * Scanners send characters extremely fast (each keystroke < 60ms apart)
 * and terminate the barcode with an Enter key.
 *
 * Default mode: ignores keystrokes that originate inside <input> / <textarea> /
 * <select> so it never interferes with user typing.
 *
 * captureFromInputs mode: intercepts scanner input even when an input field
 * has focus. Prevents scanner chars from going to the wrong field.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxKeystrokeInterval = 60,
  captureFromInputs = false,
  barcodeInputRef,
}: UseBarcodeScannerOptions): void {
  const bufferRef       = React.useRef<string>("");
  const lastKeyTimeRef  = React.useRef<number>(0);
  const clearTimerRef   = React.useRef<number | undefined>(undefined);
  const isScannerRef    = React.useRef<boolean>(false);

  // Save focused-input value BEFORE first scanner char leaks so we can restore it
  const leakTargetRef   = React.useRef<HTMLInputElement | null>(null);
  const leakSavedValRef = React.useRef<string>("");

  // Stable callback ref — avoids re-registering the event listener on every render
  const onScanRef = React.useRef(onScan);
  React.useLayoutEffect(() => { onScanRef.current = onScan; });

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag    = target.tagName;
      const isInputFocused = (
        tag === "INPUT"    ||
        tag === "TEXTAREA" ||
        tag === "SELECT"   ||
        target.isContentEditable
      );

      // ── Default mode: skip when any input has focus ────────────────────────
      if (!captureFromInputs) {
        if (isInputFocused) return;
      } else {
        // ── Capture mode: skip ONLY the dedicated barcode input (it has its
        //    own onKeyDown Enter handler). Let everything else through. ────────
        if (isInputFocused && barcodeInputRef?.current === (target as HTMLInputElement)) {
          return;
        }
      }

      const now     = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Keystrokes too slow → human typing; reset scanner state
      if (elapsed > maxKeystrokeInterval && bufferRef.current.length > 0) {
        bufferRef.current    = "";
        isScannerRef.current = false;
        leakTargetRef.current = null;
      }

      // ── Enter = end of barcode ─────────────────────────────────────────────
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code.length >= minLength && isScannerRef.current) {
          e.preventDefault();
          e.stopPropagation();

          // Restore the first char that leaked into the focused input
          if (captureFromInputs && leakTargetRef.current) {
            const input  = leakTargetRef.current;
            const saved  = leakSavedValRef.current;
            // Use the native setter so React's synthetic event fires correctly
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, "value"
            )?.set;
            setter?.call(input, saved);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }

          onScanRef.current({ barcode: code, timestamp: now });
        }
        bufferRef.current     = "";
        isScannerRef.current  = false;
        leakTargetRef.current = null;
        window.clearTimeout(clearTimerRef.current);
        return;
      }

      // Only accumulate printable characters
      if (e.key.length !== 1) return;

      if (bufferRef.current.length === 0) {
        // First char — save input state in case it leaks before we can intercept
        if (captureFromInputs && isInputFocused && tag === "INPUT") {
          leakTargetRef.current  = target as HTMLInputElement;
          leakSavedValRef.current = (target as HTMLInputElement).value;
        }
        bufferRef.current = e.key;
        // Can't confirm scanner on first char — let it through
      } else if (elapsed <= maxKeystrokeInterval) {
        // Scanner-speed keystroke — mark as scanner and suppress from input
        isScannerRef.current = true;
        if (captureFromInputs && isInputFocused) {
          e.preventDefault();
          e.stopPropagation();
        }
        bufferRef.current += e.key;
      } else {
        // Slow keystroke after a partial buffer → human restart
        bufferRef.current    = e.key;
        isScannerRef.current = false;
        if (captureFromInputs && isInputFocused && tag === "INPUT") {
          leakTargetRef.current   = target as HTMLInputElement;
          leakSavedValRef.current = (target as HTMLInputElement).value;
        } else {
          leakTargetRef.current = null;
        }
      }

      // Safety: auto-clear buffer after 400 ms of inactivity
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        bufferRef.current     = "";
        isScannerRef.current  = false;
        leakTargetRef.current = null;
      }, 400);
    };

    const listenerOptions = captureFromInputs ? { capture: true } : false;
    window.addEventListener("keydown", handleKeyDown, listenerOptions);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, listenerOptions as EventListenerOptions);
      window.clearTimeout(clearTimerRef.current);
    };
  }, [enabled, minLength, maxKeystrokeInterval, captureFromInputs, barcodeInputRef]);
}
