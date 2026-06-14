import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";
import { HardwareProvider }  from "@/contexts/hardware-context";

export default function Page() {
  return (
    <HardwareProvider>
      <RestaurantPOSView />
    </HardwareProvider>
  );
}
