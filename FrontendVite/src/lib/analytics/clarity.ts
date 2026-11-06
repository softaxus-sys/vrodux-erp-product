/**
 * Microsoft Clarity (session replay + heatmaps) - loaded ONLY on the signup funnel (/trial), never
 * inside the logged-in app. This is a B2B ERP: inside the app a replay would capture invoices,
 * payroll and customer data, so recording is restricted to the pages where a new visitor decides
 * whether to sign up. Same scoping rule as meta-pixel.ts.
 *
 * It also loads only after the visitor accepts the analytics notice (see ClarityConsent), and does
 * nothing at all until a project id is set. Mask settings (Strict) are chosen in the Clarity
 * dashboard under Settings > Masking; password fields are always masked by Clarity itself.
 *
 * Nothing personal is ever sent as a tag: no name, email, phone or company.
 */

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

/** Project id from clarity.microsoft.com > Settings > Overview. Not a secret. Empty = feature off. */
export const CLARITY_PROJECT_ID: string = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined) ?? "";

const KEY = "vrodux.analytics-consent";
let loaded = false;

export type AnalyticsConsent = "granted" | "denied" | null;

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: "granted" | "denied"): void {
  try { localStorage.setItem(KEY, value); } catch { /* private mode: the choice just lasts this page */ }
  if (value === "granted") loadClarity();
  else window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
}

/** Idempotent; does nothing without a project id or without consent. Never throws. */
export function loadClarity(): void {
  if (loaded || typeof window === "undefined" || !CLARITY_PROJECT_ID) return;
  if (getAnalyticsConsent() !== "granted") return;
  try {
    // Clarity's own bootstrap snippet, with the project id filled in.
    (function (c: any, l: Document, a: string, r: string, i: string) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode!.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
    window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    loaded = true;
  } catch {
    // An ad-blocker or CSP rule must never break signup.
  }
}

/** Filterable label on the recording, e.g. plan=micro. Non-personal values only. */
export function clarityTag(key: string, value: string | undefined): void {
  try { if (value) window.clarity?.("set", key, value); } catch { /* ignore */ }
}

/** Named moment in the funnel, e.g. signup_step_2. */
export function clarityEvent(name: string): void {
  try { window.clarity?.("event", name); } catch { /* ignore */ }
}
