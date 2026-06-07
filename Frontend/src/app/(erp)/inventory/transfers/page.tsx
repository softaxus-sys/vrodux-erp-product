import type { Metadata } from "next";
import { TransfersView } from "@/modules/inventory/transfers/components/transfers-view";
export const metadata: Metadata = { title: "Stock Transfers" };
export default function TransfersPage() { return <TransfersView />; }
