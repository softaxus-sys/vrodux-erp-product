import type { Metadata } from "next";
import { JournalsView } from "@/modules/finance/journals/components/journals-view";
export const metadata: Metadata = { title: "Journal Entries" };
export default function JournalsPage() { return <JournalsView />; }
