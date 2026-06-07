import type { Metadata } from "next";
import { VendorsView } from "@/modules/purchase/vendors/components/vendors-view";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorsView />;
}
