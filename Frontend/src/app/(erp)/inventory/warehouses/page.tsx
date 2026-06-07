import type { Metadata } from "next";
import { WarehousesView } from "@/modules/inventory/warehouses/components/warehouses-view";
export const metadata: Metadata = { title: "Warehouses" };
export default function WarehousesPage() { return <WarehousesView />; }
