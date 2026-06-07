import type { Metadata } from "next";
import { ApprovalsView } from "@/modules/purchase/approvals/components/approvals-view";

export const metadata: Metadata = { title: "Purchase Approvals" };

export default function ApprovalsPage() {
  return <ApprovalsView />;
}
