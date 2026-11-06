import * as React from "react";
import { CLARITY_PROJECT_ID, getAnalyticsConsent, loadClarity, setAnalyticsConsent } from "@/lib/analytics/clarity";

/**
 * Small notice on the signup page asking to record how the page is used. Renders nothing when
 * recording is not configured or the visitor already chose. Declining records nothing.
 */
export function ClarityConsent() {
  const [choice, setChoice] = React.useState(getAnalyticsConsent());

  React.useEffect(() => { if (choice === "granted") loadClarity(); }, [choice]);

  if (!CLARITY_PROJECT_ID || choice !== null) return null;
  const pick = (v: "granted" | "denied") => { setAnalyticsConsent(v); setChoice(v); };

  return (
    <div role="dialog" aria-label="Analytics notice"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:max-w-sm z-50 rounded-xl border border-border bg-card p-4 shadow-lg text-sm">
      <p className="text-foreground">
        Help us improve signup: we record how this page is used (clicks and scrolling, not what you type).
      </p>
      <div className="mt-3 flex gap-2 justify-end">
        <button type="button" onClick={() => pick("denied")} className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground">No thanks</button>
        <button type="button" onClick={() => pick("granted")} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Allow</button>
      </div>
    </div>
  );
}
