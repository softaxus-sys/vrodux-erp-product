import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";
import { PosOfflineProvider } from "@/contexts/pos-offline-context";
import { usePosFocusMode }  from "@/hooks/pos/use-pos-focus-mode";

export default function Page() {
  // A till operator gets the whole screen for the sell view; their sidebar preference is put back
  // when they navigate away.
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
