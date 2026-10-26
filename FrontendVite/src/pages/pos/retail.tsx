import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";
import { PosOfflineProvider } from "@/contexts/pos-offline-context";
import { usePosFocusMode }  from "@/hooks/pos/use-pos-focus-mode";
import { Navigate }         from "react-router-dom";
import { useCan }           from "@/components/auth/can";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { BranchGate, ShiftBranchLock } from "@/modules/pos/restaurant/components/branch-gate";

export default function Page() {
  // The sell screen takes the full width; the sidebar preference is restored on the way out.
  usePosFocusMode();
  // Restaurant roles can open a shift but are not retail cashiers — a typed URL lands them on their own till.
  const canSellRetail = useCan("pos.products.view");
  const { branchId } = useCurrentBranch();
  if (!canSellRetail) return <Navigate to="/pos/restaurant" replace />;

  return (
    <HardwareProvider>
      <PosOfflineProvider>
        {/* A retail shift belongs to a branch, so its sales take that branch's own stock. */}
        <BranchGate>
          <ShiftGate branchId={branchId}>
            <ShiftBranchLock>
              <RetailPOSView />
            </ShiftBranchLock>
          </ShiftGate>
        </BranchGate>
      </PosOfflineProvider>
    </HardwareProvider>
  );
}
