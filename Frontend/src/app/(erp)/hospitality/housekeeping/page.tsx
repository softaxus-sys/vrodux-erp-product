import type { Metadata } from "next";
import { HousekeepingView } from "@/modules/hospitality/housekeeping/components/housekeeping-view";

export const metadata: Metadata = { title: "Housekeeping" };

export default function HousekeepingPage() {
  return <HousekeepingView />;
}
