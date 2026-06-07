import type { Metadata } from "next";
import { LeavesView } from "@/modules/hr/leaves/components/leaves-view";

export const metadata: Metadata = { title: "Leave Management" };

export default function LeavesPage() {
  return <LeavesView />;
}
