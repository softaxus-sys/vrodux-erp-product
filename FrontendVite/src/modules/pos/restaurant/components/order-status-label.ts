import * as React from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "@/components/auth/can";
import { useDeliveryOrders } from "@/hooks/restaurant/use-restaurant";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";

/**
 * The words for an order's status. A delivery is never "served": once it has left the kitchen its
 * status is the rider's — picked up, on the way, delivered — and where no rider has reported yet,
 * a handed-over delivery reads "Delivered" rather than borrowing the dine-in word.
 */
export function useOrderStatusLabel() {
  const { t } = useTranslation("restaurant");
  const canSeeDeliveries = useCan("restaurant.delivery.view");
  const { data: deliveries = [] } = useDeliveryOrders(undefined, canSeeDeliveries);
  const legByOrder = React.useMemo(() => new Map(deliveries.map(d => [d.orderId, d.status])), [deliveries]);

  return React.useCallback((o: Pick<RestaurantOrder, "id" | "status" | "orderType">) => {
    const plain = t(`orders.status.${o.status}`, { defaultValue: o.status });
    if (o.orderType !== "delivery" || !["sent", "ready", "served"].includes(o.status)) return plain;
    const leg = legByOrder.get(o.id);
    if (leg && leg !== "assigned") return t(`delivery.status.${leg}`);
    return o.status === "served" ? t("delivery.status.delivered") : plain;
  }, [t, legByOrder]);
}
