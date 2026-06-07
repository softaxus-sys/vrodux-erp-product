import type { Metadata } from "next";
import { TenantsView } from "@/modules/real-estate/tenants/components/tenants-view";
export const metadata: Metadata = { title: "Tenants" };
export default function TenantsPage() { return <TenantsView />; }
