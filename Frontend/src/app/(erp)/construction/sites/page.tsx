import type { Metadata } from "next";
import { SitesView } from "@/modules/construction/sites/components/sites-view";
export const metadata: Metadata = { title: "Site Management" };
export default function SitesPage() { return <SitesView />; }
