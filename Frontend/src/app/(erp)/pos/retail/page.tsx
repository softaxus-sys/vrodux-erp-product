import type { Metadata } from "next";
import { RetailPOSView } from "@/modules/pos/retail/components/retail-pos-view";

export const metadata: Metadata = { title: "Retail POS" };

export default function RetailPOSPage() {
  return <RetailPOSView />;
}
