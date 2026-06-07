import type { Metadata } from "next";
import { IntegrationsView } from "@/modules/settings/integrations/components/integrations-view";
export const metadata: Metadata = { title: "Integrations" };
export default function IntegrationsPage() { return <IntegrationsView />; }
