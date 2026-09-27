import { PackageX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { usePosSettings, useSetAllowOutOfStockSales } from "@/hooks/pos/use-pos-settings";

/**
 * Per-store choice: may the till sell an item whose recorded stock is zero or below?
 * For shops that don't keep stock counts in the system - otherwise nothing they never received
 * through a stock entry could be rung up. Stock simply goes negative when it's on.
 */
export function OutOfStockSettings() {
  const { data, isLoading } = usePosSettings();
  const update  = useSetAllowOutOfStockSales();
  const canEdit = useCan("pos.sessions.approve");
  const allowed = data?.allowOutOfStockSales ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
            allowed ? "bg-warning/15" : "bg-primary/10")}>
            <PackageX className={cn("h-5 w-5", allowed ? "text-warning" : "text-primary")} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-bold">Sell items that are out of stock</p>
            <p className="text-sm text-muted-foreground">
              {allowed
                ? "On: the till sells any item even when its stock is 0. Stock goes negative - use this if the store doesn't record stock."
                : "Off: an item with no stock is greyed out at the till and can't be sold until stock is added in Inventory."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
            <span className="text-xs font-semibold text-muted-foreground w-7 text-right">{allowed ? "Yes" : "No"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={allowed}
              aria-label="Sell items that are out of stock"
              disabled={!canEdit || isLoading || update.isPending}
              onClick={() => update.mutate(!allowed)}
              title={canEdit ? undefined : "Only a POS supervisor or administrator can change this"}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50",
                allowed ? "bg-warning" : "bg-muted-foreground/30")}
            >
              {update.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white mx-auto" />
                : <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                    allowed ? "translate-x-5" : "translate-x-0.5")} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
