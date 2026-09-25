import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marks a Unit Number / Owner Details value the caller is not permitted to see.
 *
 * Shown instead of a blank cell on purpose — a hidden-because-restricted field must never read the
 * same as a genuinely empty one, or a compliance review has no way to tell "no data" apart from
 * "access controlled". Used everywhere `!listing.hasConfidentialAccess`: the stock list table, the
 * listing drawer, and the create/edit form.
 */
export function RestrictedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70",
        className,
      )}
      title="Visible only to this listing's assigned agent and tenant admins"
    >
      <Lock className="h-3 w-3 shrink-0" />
      Restricted
    </span>
  );
}
