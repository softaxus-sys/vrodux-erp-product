import * as React from "react";
import { useTranslation } from "react-i18next";
import { LogOut, AlertTriangle } from "lucide-react";
import { useOptionalShift } from "@/modules/pos/retail/components/shift-gate";
import { useOrders } from "@/hooks/restaurant/use-restaurant";

/**
 * Ends the cashier's shift from the restaurant till. Shown only to someone running a till (inside
 * ShiftGate) — waiters work under the cashier's shift and have nothing to close.
 *
 * Bills still open on the shift are allowed: a table often runs across a shift change. They carry
 * over to the next shift opened at this branch and are counted in that shift when paid — the
 * cashier is told so before the cash count starts.
 */
export function CloseShiftButton({ className }: { className?: string }) {
  const { t } = useTranslation("restaurant");
  const shift = useOptionalShift();
  const { data: openPage } = useOrders({ status: "open", pageSize: 200 });
  const [confirm, setConfirm] = React.useState(false);

  if (!shift) return null;

  const openOnShift = (openPage?.items ?? []).filter(o => o.sessionId === shift.sessionId).length;
  const start = () => (openOnShift > 0 ? setConfirm(true) : shift.openClosePanel());

  return (
    <>
      <button onClick={start} title={t("shift.close")} className={className}>
        <LogOut className="h-5 w-5" />{t("shift.close")}
      </button>
      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-warning" />
              <h2 className="text-lg font-bold">{t("shift.openBillsTitle", { count: openOnShift })}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("shift.openBillsBody")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} className="h-10 px-4 rounded-lg border border-border font-medium">
                {t("shift.keepOpen")}
              </button>
              <button onClick={() => { setConfirm(false); shift.openClosePanel(); }}
                className="h-10 px-4 rounded-lg bg-destructive text-destructive-foreground font-semibold">
                {t("shift.closeAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
