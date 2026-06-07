import type { Metadata } from "next";
import { TaxView } from "@/modules/finance/tax/components/tax-view";
export const metadata: Metadata = { title: "Tax & VAT" };
export default function TaxPage() { return <TaxView />; }
