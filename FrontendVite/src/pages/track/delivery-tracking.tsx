import * as React from "react";
import { useParams } from "react-router-dom";
import { Loader2, Truck, CheckCircle2, XCircle, Package } from "lucide-react";
import { restaurantApi } from "@/lib/restaurant/restaurant.api";
import type { DeliveryTracking, DeliveryStatus } from "@/lib/restaurant/restaurant.api";

const STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: "assigned", label: "Order Confirmed" },
  { status: "picked_up", label: "Picked Up" },
  { status: "enroute", label: "On the Way" },
  { status: "delivered", label: "Delivered" },
];

export default function DeliveryTrackingPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [tracking, setTracking] = React.useState<DeliveryTracking | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = () => restaurantApi.trackDelivery(token)
      .then(t => { if (!cancelled) setTracking(t); })
      .catch(() => { if (!cancelled) setError("Tracking link not found."); });
    load();
    const id = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-6"><p className="text-muted-foreground">{error}</p></div>;
  }
  if (!tracking) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const currentIdx = STEPS.findIndex(s => s.status === tracking.status);
  const failed = tracking.status === "failed";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          {failed ? <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" /> : <Truck className="w-12 h-12 text-primary mx-auto mb-2" />}
          <h1 className="text-lg font-bold text-foreground">Order {tracking.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{tracking.address}</p>
        </div>

        {failed ? (
          <p className="text-center text-sm text-destructive">This delivery could not be completed. Please contact the restaurant.</p>
        ) : (
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done = i <= currentIdx;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-success text-white" : "bg-muted text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Package className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-sm ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {tracking.driverName && !failed && (
          <p className="text-center text-sm text-muted-foreground">Driver: <span className="text-foreground font-medium">{tracking.driverName}</span></p>
        )}
        {tracking.estimatedDeliveryAt && !tracking.deliveredAt && !failed && (
          <p className="text-center text-xs text-muted-foreground">
            Estimated arrival: {new Date(tracking.estimatedDeliveryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
