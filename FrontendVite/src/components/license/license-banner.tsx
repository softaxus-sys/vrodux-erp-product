import * as React from "react";
import { ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const DISMISS_KEY = "vrodux.licenseBanner.dismissedAt";

/**
 * Countdown to a licence expiring on an on-premises installation.
 *
 * An on-premises box is gated by a signed licence, not a subscription, so `trial_days_left` is
 * always null there and the trial banner never appeared. The licence simply stopped working one
 * morning and every request began returning 403 — for a shop mid-trading, the worst possible way
 * to discover the renewal was due.
 *
 * Deliberately separate from TrialBanner rather than folded into it: the claim is different, and
 * so is the remedy. "Choose a plan" is meaningless here — there is no plan to buy, there is a key
 * to install, and the person who can do that is usually not the one looking at the screen.
 */
export function LicenseBanner() {
  const tenant   = useAuthStore(s => s.tenant);
  const daysLeft = tenant?.licenseDaysLeft;
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      const ageMs = Date.now() - Number(raw);
      setDismissed(Number.isFinite(ageMs) && ageMs < 24 * 60 * 60 * 1000);
    } catch { /* ignore */ }
  }, []);

  if (daysLeft === null || daysLeft === undefined) return null;
  // 30 days, not the trial banner's 15: renewing a licence means contacting a supplier and getting
  // a key issued, which takes longer than entering a card.
  if (daysLeft > 30 || daysLeft < 0) return null;

  const urgent = daysLeft <= 7;
  if (dismissed && !urgent) return null;

  return (
    <div className={cn(
      "flex items-center justify-center gap-3 px-4 py-2 text-sm border-b",
      urgent
        ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
        : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
    )}>
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        {daysLeft === 0
          ? "This installation's licence expires today"
          : `Licence expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
      </span>
      <span className="opacity-80">
        Contact Softaxis for a renewal key — the system stops accepting work when it lapses.
      </span>
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
