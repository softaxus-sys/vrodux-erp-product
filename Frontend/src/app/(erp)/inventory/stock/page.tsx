import type { Metadata } from "next";
import { StockView } from "@/modules/inventory/stock/components/stock-view";
export const metadata: Metadata = { title: "Stock" };
export default function StockPage() { return <StockView />; }
