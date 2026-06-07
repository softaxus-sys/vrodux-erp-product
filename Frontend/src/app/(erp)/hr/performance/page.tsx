import type { Metadata } from "next";
import { PerformanceView } from "@/modules/hr/performance/components/performance-view";

export const metadata: Metadata = { title: "Performance" };

export default function PerformancePage() {
  return <PerformanceView />;
}
