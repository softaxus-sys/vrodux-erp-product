import * as React from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { useOptionalShift } from "@/modules/pos/retail/components/shift-gate";

/**
 * A restaurant till always works at one branch. When the workspace has branches and none is
 * selected ("All Branches"), this asks which branch the till is at before showing the till — so the
 * shift, orders, tables and kitchen tickets are never created without a branch. A workspace with no
 * branches passes straight through (single-location restaurant).
 */
export function BranchGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("restaurant");
  const { branchId, options, setBranchId } = useCurrentBranch();

  if (options.length === 0 || branchId) return <>{children}</>;

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t("branch.chooseTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{t("branch.chooseBody")}</p>
        <div className="grid gap-2">
          {options.map(b => (
            <button key={b.id} onClick={() => setBranchId(b.id)}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-start hover:border-primary hover:bg-primary/5 transition-colors">
              <span className="font-medium">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * While a cashier's shift is open, the screen stays on the shift's branch: the server refuses orders
 * from a shift at another branch, so letting the switcher drift would only produce errors.
 */
export function ShiftBranchLock({ children }: { children: React.ReactNode }) {
  const shift = useOptionalShift();
  const { branchId, setBranchId } = useCurrentBranch();
  const shiftBranch = shift?.session.branchId ?? null;

  React.useEffect(() => {
    if (shiftBranch && shiftBranch !== branchId) setBranchId(shiftBranch);
  }, [shiftBranch, branchId, setBranchId]);

  return <>{children}</>;
}

/** True while an open shift pins the till to its branch — the switcher hides its other choices. */
export function useShiftPinsBranch(): boolean {
  const shift = useOptionalShift();
  return !!shift?.session.branchId;
}
