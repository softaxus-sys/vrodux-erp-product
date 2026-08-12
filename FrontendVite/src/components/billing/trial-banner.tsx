import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const DISMISS_KEY = "vrodux.trialBanner.dismissedAt";

/**
 * Slim countdown shown inside the app while a trial is running out.
 *
 * Reads the JWT's `trial_days_left` claim rather than calling the API, so it costs nothing and
 * appears on every page. Deliberately only shows inside the reminder window (≤15 days) — nagging a
 * customer on day 2 of 30 just trains them to ignore it.
 *
 * Dismissal lasts one day, so the reminder returns as the deadline approaches; at ≤3 days it can't
 * be dismissed at all, because losing access unexpectedly is far more annoying than a banner.
 */
export function TrialBanner() {
  const tenant = useAuthStore(s => s.tenant);
  const daysLeft = tenant?.trialDaysLeft;
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      const ageMs = Date.now() - Number(raw);
      setDismissed(Number.isFinite(ageMs) && ageMs < 24 * 60 * 60 * 1000);
    } catch { /* ignore */ }
  }, []);

  // subscription_state is the authoritative gate; the countdown only means anything on a trial.
  if (tenant?.subscriptionState && tenant.subscriptionState !== "trial") return null;
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft > 15 || daysLeft < 0) return null;

  const urgent = daysLeft <= 3;
  if (dismissed && !urgent) return null;

  return (
    <div className={cn(
      "flex items-center justify-center gap-3 px-4 py-2 text-sm border-b",
      urgent
        ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
        : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
    )}>
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        {daysLeft === 0
          ? "Your free trial ends today"
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
      </span>
      <Link to="/settings/billing" className="font-semibold underline underline-offset-2 hover:no-underline">
        Choose a plan
      </Link>
      {!urgent && (
        <button
          aria-label="Dismiss for today"
          className="ml-2 opacity-60 hover:opacity-100"
          onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
            setDismissed(true);
          }}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
