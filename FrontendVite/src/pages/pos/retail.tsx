import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";
import { CashDrawerGuard }  from "@/components/pos/cash-drawer-guard";

export default function Page() {
  return (
    <HardwareProvider>
      {/* CashDrawerGuard renders a full-screen blocker while the drawer is open */}
      <CashDrawerGuard />
      <ShiftGate>
        <RetailPOSView />
      </ShiftGate>
    </HardwareProvider>
  );
}
