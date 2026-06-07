import type { Metadata } from "next";
import { PropertiesView } from "@/modules/real-estate/properties/components/properties-view";
export const metadata: Metadata = { title: "Properties" };
export default function PropertiesPage() { return <PropertiesView />; }
