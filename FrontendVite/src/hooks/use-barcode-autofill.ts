import * as React from "react";
import { inventoryProductsApi } from "@/lib/inventory/products.api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BarcodeAutofillSource = string;
export type BarcodeAutofillStatus = "idle" | "loading" | "found" | "not-found" | "error";

export interface BarcodeAutofillData {
  name:          string;
  description:   string;
  /** The cleaned-up code (a QR that held a web link comes back as the number inside it). */
  barcode:       string;
  imageUrl?:     string;
  brand?:        string;
  category?:     string;
  /** Pack size as printed, e.g. "500 g". */
  quantity?:     string;
  source:        BarcodeAutofillSource;
  /** True when the barcode already exists in the local product catalogue. */
  alreadyExists: boolean;
}

export interface UseBarcodeAutofillReturn {
  status:  BarcodeAutofillStatus;
  data:    BarcodeAutofillData | null;
  error:   string | null;
  /** Trigger a lookup for the given barcode string. */
  lookup:  (barcode: string) => Promise<void>;
  /** Reset to idle state. */
  clear:   () => void;
}

// ── Source label map (shown in UI) ────────────────────────────────────────────

export const AUTOFILL_SOURCE_LABELS: Record<string, string> = {
  local:             "local catalogue",
  openfoodfacts:     "Open Food Facts",
  openbeautyfacts:   "Open Beauty Facts",
  openproductsfacts: "Open Products Facts",
  openpetfoodfacts:  "Open Pet Food Facts",
  upcitemdb:         "UPCitemdb",
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useBarcodeAutofill
 *
 * Imperative lookup hook - call `lookup(code)` after a scan. One server call checks the workspace's own
 * stock first, then the public product databases (Open Food Facts and its sister projects, UPCitemdb), so
 * every device gets the same answer and no browser cross-origin rule or per-IP rate limit gets in the way.
 *
 * Returns autofill-friendly data. If the code already exists locally, `alreadyExists = true` is set so the UI
 * can warn the user without blocking them.
 */
export function useBarcodeAutofill(): UseBarcodeAutofillReturn {
  const [status, setStatus] = React.useState<BarcodeAutofillStatus>("idle");
  const [data,   setData]   = React.useState<BarcodeAutofillData | null>(null);
  const [error,  setError]  = React.useState<string | null>(null);

  // Track the newest request so a slow earlier answer cannot overwrite a later scan.
  const latest = React.useRef(0);

  const lookup = React.useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;

    const mine = ++latest.current;
    setStatus("loading");
    setData(null);
    setError(null);

    try {
      const res = await inventoryProductsApi.lookup(code);
      if (mine !== latest.current) return;

      if (res.existing) {
        setData({
          name:          res.existing.name,
          description:   res.existing.description ?? "",
          barcode:       res.existing.barcode ?? res.code,
          imageUrl:      res.existing.imageUrl ?? undefined,
          brand:         res.existing.brandName ?? undefined,
          source:        "local",
          alreadyExists: true,
        });
        setStatus("found");
        return;
      }

      if (res.suggested) {
        const s = res.suggested;
        setData({
          name:          s.name,
          description:   s.description ?? "",
          barcode:       res.code,
          imageUrl:      s.imageUrl ?? undefined,
          brand:         s.brand ?? undefined,
          category:      s.category ?? undefined,
          quantity:      s.quantity ?? undefined,
          source:        s.source,
          alreadyExists: false,
        });
        setStatus("found");
        return;
      }

      setStatus("not-found");
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof Error ? e.message : "Lookup failed");
      setStatus("error");
    }
  }, []);

  const clear = React.useCallback(() => {
    latest.current++;
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  // Ignore any answer that arrives after the component is gone.
  React.useEffect(() => () => { latest.current++; }, []);

  return { status, data, error, lookup, clear };
}
