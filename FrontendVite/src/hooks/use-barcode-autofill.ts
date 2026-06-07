import * as React from "react";
import { inventoryProductsApi } from "@/lib/inventory/products.api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BarcodeAutofillSource = "local" | "openfoodfacts" | "upcitemdb";
export type BarcodeAutofillStatus = "idle" | "loading" | "found" | "not-found" | "error";

export interface BarcodeAutofillData {
  name:          string;
  description:   string;
  barcode:       string;
  imageUrl?:     string;
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

export const AUTOFILL_SOURCE_LABELS: Record<BarcodeAutofillSource, string> = {
  local:         "local catalogue",
  openfoodfacts: "Open Food Facts",
  upcitemdb:     "UPC Item DB",
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useBarcodeAutofill
 *
 * Imperative lookup hook — call `lookup(barcode)` to trigger a three-step chain:
 *   1. Local POS product catalogue  (GET /api/products/barcode/{code})
 *   2. Open Food Facts               (https://world.openfoodfacts.org/api/v0/product/{code}.json)
 *   3. UPC Item DB                   (https://api.upcitemdb.com/prod/trial/lookup?upc={code})
 *
 * Returns autofill-friendly data (name, description, imageUrl, source).
 * If the barcode already exists locally, `alreadyExists = true` is set so the
 * UI can warn the user without blocking them.
 */
export function useBarcodeAutofill(): UseBarcodeAutofillReturn {
  const [status, setStatus] = React.useState<BarcodeAutofillStatus>("idle");
  const [data,   setData]   = React.useState<BarcodeAutofillData | null>(null);
  const [error,  setError]  = React.useState<string | null>(null);

  // Track in-flight request so stale responses are ignored
  const abortRef = React.useRef<AbortController | null>(null);

  const lookup = React.useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;

    // Cancel any previous in-flight lookup
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus("loading");
    setData(null);
    setError(null);

    // ── Step 1: Local catalogue (Inventory — UNIONs both pos + inventory DBs) ─
    try {
      const product = await inventoryProductsApi.getByBarcode(code);
      if (ac.signal.aborted) return;
      setData({
        name:          product.name,
        description:   (product as any).description ?? "",
        barcode:       code,
        imageUrl:      (product as any).imageUrl ?? undefined,
        source:        "local",
        alreadyExists: true,
      });
      setStatus("found");
      return;
    } catch {
      // 404 or network error — fall through to external APIs
      if (ac.signal.aborted) return;
    }

    // ── Step 2: Open Food Facts ──────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
        { signal: ac.signal },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.status === 1 && json.product) {
          const p    = json.product;
          const name = (p.product_name_en || p.product_name || p.generic_name || "").trim();
          if (name) {
            if (ac.signal.aborted) return;
            setData({
              name,
              description: (p.generic_name !== name ? p.generic_name : "") ||
                           p.ingredients_text_en || p.ingredients_text || "",
              barcode:  code,
              imageUrl: p.image_front_url ?? undefined,
              source:   "openfoodfacts",
              alreadyExists: false,
            });
            setStatus("found");
            return;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // network/parse error — continue to next source
    }

    // ── Step 3: UPC Item DB ──────────────────────────────────────────────────
    try {
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
        { signal: ac.signal },
      );
      if (res.ok) {
        const json = await res.json();
        const item = json.items?.[0];
        if (item?.title) {
          if (ac.signal.aborted) return;
          const desc = [item.brand, item.description].filter(Boolean).join(" — ");
          setData({
            name:          item.title,
            description:   desc,
            barcode:       code,
            imageUrl:      item.images?.[0] ?? undefined,
            source:        "upcitemdb",
            alreadyExists: false,
          });
          setStatus("found");
          return;
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }

    if (ac.signal.aborted) return;
    setStatus("not-found");
  }, []);

  const clear = React.useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  // Clean up on unmount
  React.useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { status, data, error, lookup, clear };
}
