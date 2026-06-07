import type { Metadata } from "next";
import { InvoicingView } from "@/modules/finance/invoicing/components/invoicing-view";

export const metadata: Metadata = { title: "Invoicing" };

export default function InvoicingPage() {
  return <InvoicingView />;
}
