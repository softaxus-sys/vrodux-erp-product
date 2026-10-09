import { useTranslation }    from "react-i18next";
import { AlertTriangle }     from "lucide-react";
import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";
import { HardwareProvider }  from "@/contexts/hardware-context";
import { ShiftGate }         from "@/modules/pos/retail/components/shift-gate";
import { usePosFocusMode }   from "@/hooks/pos/use-pos-focus-mode";
import { useCan }            from "@/components/auth/can";
import { useOpenShift }      from "@/hooks/restaurant/use-restaurant";

export default function Page() {
  // Same as retail: the order screen takes the full width.
  usePosFocusMode();
  // Whoever runs a till opens their own shift. Floor staff (waiters) do not handle a drawer: they
  // take orders under the cashier's open shift, so they are never asked to count cash.
  const runsTill = useCan("pos.sessions.create");

  return (
    <HardwareProvider>
      {runsTill ? (
        <ShiftGate>
          <RestaurantPOSView />
        </ShiftGate>
      ) : (
        <FloorStaff />
      )}
    </HardwareProvider>
  );
}

function FloorStaff() {
  const { t } = useTranslation("restaurant");
  const { data: shift } = useOpenShift();
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {shift && !shift.isOpen && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-warning/15 text-warning text-sm font-extrabold border-b-2 border-warning/30">
          <AlertTriangle className="h-5 w-5 shrink-0" />{t("posView.noOpenTill")}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col"><RestaurantPOSView /></div>
    </div>
  );
}
