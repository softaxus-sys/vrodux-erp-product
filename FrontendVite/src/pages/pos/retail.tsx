import { ShiftGate }        from "@/modules/pos/retail/components/shift-gate";
import { RetailPOSView }    from "@/modules/pos/retail/components/retail-pos-view";
import { HardwareProvider } from "@/contexts/hardware-context";

export default function Page() {
  return (
    <HardwareProvider>
      <ShiftGate>
        <RetailPOSView />
      </ShiftGate>
    </HardwareProvider>
  );
}
