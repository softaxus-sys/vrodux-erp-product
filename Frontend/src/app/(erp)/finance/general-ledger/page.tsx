import type { Metadata } from "next";
import { GLView } from "@/modules/finance/general-ledger/components/gl-view";
export const metadata: Metadata = { title: "General Ledger" };
export default function GeneralLedgerPage() { return <GLView />; }
