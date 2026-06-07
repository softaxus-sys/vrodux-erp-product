import type { Metadata } from "next";
import { BrokersView } from "@/modules/real-estate/brokers/components/brokers-view";
export const metadata: Metadata = { title: "Brokers & Agents" };
export default function BrokersPage() { return <BrokersView />; }
