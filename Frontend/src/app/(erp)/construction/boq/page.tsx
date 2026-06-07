import type { Metadata } from "next";
import { BOQView } from "@/modules/construction/boq/components/boq-view";
export const metadata: Metadata = { title: "Bill of Quantities" };
export default function BoqPage() { return <BOQView />; }
