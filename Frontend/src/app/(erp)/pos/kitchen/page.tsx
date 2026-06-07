import type { Metadata } from "next";
import { KitchenDisplayView } from "@/modules/pos/kitchen/components/kitchen-display-view";

export const metadata: Metadata = { title: "Kitchen Display" };

export default function KitchenDisplayPage() {
  return <KitchenDisplayView />;
}
