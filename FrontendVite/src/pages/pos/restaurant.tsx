import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";
import { HardwareProvider }  from "@/contexts/hardware-context";
import { ShiftGate }         from "@/modules/pos/retail/components/shift-gate";

export default function Page() {
  return (
    <HardwareProvider>
      <ShiftGate>
        <RestaurantPOSView />
      </ShiftGate>
    </HardwareProvider>
  );
}
