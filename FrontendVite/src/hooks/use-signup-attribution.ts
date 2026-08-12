import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { normaliseBillingPeriod, type BillingPeriod } from "@/lib/billing/plans";

const STORAGE_KEY = "vrodux.signup.attribution";

export interface SignupAttribution {
  /** Plan slug from the pricing page ("micro" | "starter" | "professional"). */
  plan: string | null;
  billing: BillingPeriod;
  /** "trial" | "buy" — `buy` routes to checkout after signup. */
  intent: string | null;
  utmSource: string | null;
}

const EMPTY: SignupAttribution = { plan: null, billing: "annual", intent: null, utmSource: null };

function read(): SignupAttribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    // Private-browsing / storage-disabled — attribution is a nice-to-have, never a blocker.
    return EMPTY;
  }
}

/**
 * Capture the marketing query string on first render and keep it for the whole signup.
 *
 * The onboarding flow spans several steps, so by the time the user submits, the original
 * `?plan=…&billing=…` is long gone from the URL. Persisting to sessionStorage means a refresh
 * mid-signup still buys the plan the user actually clicked. Params are stripped from the URL
 * afterwards so the address bar stays clean and a back-navigation can't re-apply stale values.
 */
export function useSignupAttribution(): SignupAttribution {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = React.useState<SignupAttribution>(read);

  React.useEffect(() => {
    const plan      = searchParams.get("plan");
    const billing   = searchParams.get("billing");
    const intent    = searchParams.get("intent");
    const utmSource = searchParams.get("utm_source");

    if (!plan && !billing && !intent && !utmSource) return;

    const next: SignupAttribution = {
      plan:      plan      ?? value.plan,
      billing:   billing ? normaliseBillingPeriod(billing) : value.billing,
      intent:    intent    ?? value.intent,
      utmSource: utmSource ?? value.utmSource,
    };

    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setValue(next);

    ["plan", "billing", "intent", "utm_source"].forEach(k => searchParams.delete(k));
    setSearchParams(searchParams, { replace: true });
    // Runs only while the params are still present; the delete above makes it self-terminating.
  }, [searchParams, setSearchParams, value]);

  return value;
}

/** Clear the stash once signup completes, so a later signup in the same tab starts clean. */
export function clearSignupAttribution(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
