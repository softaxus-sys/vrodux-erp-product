import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";
import { PosOfflineProvider } from "@/contexts/pos-offline-context";
import { usePosFocusMode }  from "@/hooks/pos/use-pos-focus-mode";

export default function Page() {
  // The sell screen takes the full width; the sidebar preference is restored on the way out.
  usePosFocusMode();

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
