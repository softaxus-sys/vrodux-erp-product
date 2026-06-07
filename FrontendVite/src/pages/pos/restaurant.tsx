import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";
import { HardwareProvider }  from "@/contexts/hardware-context";
import { CashDrawerGuard }   from "@/components/pos/cash-drawer-guard";

export default function Page() {
  return (
    <HardwareProvider>
      {/* CashDrawerGuard renders a full-screen blocker while the drawer is open */}
      <CashDrawerGuard />
      <RestaurantPOSView />
    </HardwareProvider>
  );
}
