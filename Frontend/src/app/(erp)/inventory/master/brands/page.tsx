import type { Metadata } from "next";
import { BrandsView } from "@/modules/inventory/master/components/brands-view";
export const metadata: Metadata = { title: "Brands" };
export default function BrandsPage() { return <BrandsView />; }
