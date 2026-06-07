import type { Metadata } from "next";
import { AuditView } from "@/modules/settings/audit/components/audit-view";
export const metadata: Metadata = { title: "Audit Logs" };
export default function AuditPage() { return <AuditView />; }
