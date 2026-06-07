import type { Metadata } from "next";
import { UnitsView } from "@/modules/real-estate/units/components/units-view";
export const metadata: Metadata = { title: "Units" };
export default function UnitsPage() { return <UnitsView />; }
