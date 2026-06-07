import type { Metadata } from "next";
import { UoMView } from "@/modules/inventory/master/components/uom-view";
export const metadata: Metadata = { title: "Units of Measure" };
export default function UoMPage() { return <UoMView />; }
