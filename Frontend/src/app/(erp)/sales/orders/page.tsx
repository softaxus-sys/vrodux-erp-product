import type { Metadata } from "next";
import { OrdersView } from "@/modules/sales/orders/components/orders-view";

export const metadata: Metadata = { title: "Sales Orders" };

export default function SalesOrdersPage() {
  return <OrdersView />;
}
