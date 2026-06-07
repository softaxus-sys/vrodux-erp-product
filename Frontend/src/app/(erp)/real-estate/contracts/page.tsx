import type { Metadata } from "next";
import { ContractsView } from "@/modules/real-estate/contracts/components/contracts-view";
export const metadata: Metadata = { title: "Contracts" };
export default function ContractsPage() { return <ContractsView />; }
