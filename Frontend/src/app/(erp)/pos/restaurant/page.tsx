import type { Metadata } from "next";
import { RestaurantPOSView } from "@/modules/pos/restaurant/components/restaurant-pos-view";

export const metadata: Metadata = { title: "Restaurant POS" };

export default function RestaurantPOSPage() {
  return <RestaurantPOSView />;
}
