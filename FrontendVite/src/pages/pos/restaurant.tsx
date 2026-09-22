import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";
import { HardwareProvider }  from "@/contexts/hardware-context";
import { ShiftGate }         from "@/modules/pos/retail/components/shift-gate";
import { usePosFocusMode }   from "@/hooks/pos/use-pos-focus-mode";

export default function Page() {
  // Same as retail: a till operator gets the full width while taking orders.
  usePosFocusMode();

  return (
    <HardwareProvider>
      <ShiftGate>
        <RestaurantPOSView />
      </ShiftGate>
    </HardwareProvider>
  );
}
