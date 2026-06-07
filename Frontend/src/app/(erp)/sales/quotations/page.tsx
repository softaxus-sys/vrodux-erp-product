import type { Metadata } from "next";
import { QuotationsView } from "@/modules/sales/quotations/components/quotations-view";

export const metadata: Metadata = { title: "Quotations" };

export default function QuotationsPage() {
  return <QuotationsView />;
}
