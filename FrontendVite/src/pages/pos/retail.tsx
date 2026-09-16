import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";
import { PosOfflineProvider } from "@/contexts/pos-offline-context";

export default function Page() {
  return (
    <HardwareProvider>
      <PosOfflineProvider>
        <ShiftGate>
          <RetailPOSView />
        </ShiftGate>
      </PosOfflineProvider>
    </HardwareProvider>
  );
}
