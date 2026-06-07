import type { Metadata } from "next";
import { BankingView } from "@/modules/finance/banking/components/banking-view";
export const metadata: Metadata = { title: "Banking" };
export default function BankingPage() { return <BankingView />; }
